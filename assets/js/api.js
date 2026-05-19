/**
 * joyride.cool — API helper shared by every page that needs to
 * talk to the Joyride backend.
 *
 * Auth model:
 *   - Login / signup return { sessionToken, rider } from the API.
 *   - We persist sessionToken in localStorage (LS_TOKEN_KEY).
 *   - Every authenticated request sends `Authorization: Bearer <token>`.
 *   - We deliberately do NOT rely on cross-origin cookies — Safari's
 *     third-party cookie restrictions make that path brittle, and the
 *     server already supports the Bearer fallback (see
 *     authenticateRider in joiryde-server-deploy/server/rider-auth.ts).
 *
 * Single source of truth for:
 *   - API_BASE (Railway URL)
 *   - getToken() / setToken() / clearToken()
 *   - apiGet() / apiPost() (auto-attach Bearer)
 *   - loadCurrentUser() (resolves to the rider or null)
 *   - routeAfterAuth(rider) (admin → admin tool, driver → /{username},
 *     plain rider → /account, mirroring Daves spec)
 */
(function (global) {
  "use strict";

  // Railway production API. If we ever stand up staging/preview
  // backends, override here (or wire to a build-time env injection).
  var API_BASE = "https://joiryde-api-production.up.railway.app";

  var LS_TOKEN_KEY = "jr_session_token";
  var LS_USER_KEY = "jr_session_user"; // cached rider response, refreshed via /me

  function getToken() {
    try {
      return localStorage.getItem(LS_TOKEN_KEY) || null;
    } catch (e) {
      return null;
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(LS_TOKEN_KEY, token);
      else localStorage.removeItem(LS_TOKEN_KEY);
    } catch (e) {
      // localStorage can throw in private mode on some browsers; the
      // user just stays "logged out" in that tab — acceptable.
    }
  }

  function cacheUser(user) {
    try {
      if (user) localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(LS_USER_KEY);
    } catch (e) { /* see setToken */ }
  }

  function readCachedUser() {
    try {
      var raw = localStorage.getItem(LS_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearAuth() {
    setToken(null);
    cacheUser(null);
  }

  function authHeaders() {
    var token = getToken();
    var h = { "Content-Type": "application/json", "Accept": "application/json" };
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  }

  /** ApiError carries the HTTP status + parsed body so callers can
   *  differentiate "wrong password" (401) from "username taken" (409). */
  function ApiError(message, status, body) {
    var e = new Error(message);
    e.status = status;
    e.body = body;
    return e;
  }

  async function apiGet(path) {
    var res = await fetch(API_BASE + path, {
      method: "GET",
      headers: authHeaders(),
      credentials: "omit",
    });
    var body = null;
    try { body = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw ApiError((body && body.error) || res.statusText, res.status, body);
    return body;
  }

  async function apiPost(path, payload) {
    var res = await fetch(API_BASE + path, {
      method: "POST",
      headers: authHeaders(),
      credentials: "omit",
      body: JSON.stringify(payload || {}),
    });
    var body = null;
    try { body = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw ApiError((body && body.error) || res.statusText, res.status, body);
    return body;
  }

  /**
   * Resolve the current user from the server. Returns the rider row
   * with { id, userId, role, userType, firstName, ... } or null if
   * the token is missing/expired. Caches the response for the next
   * navigation so pages can render an instant header without a
   * round-trip.
   */
  async function loadCurrentUser() {
    if (!getToken()) return null;
    try {
      var data = await apiGet("/api/rider/me");
      var user = (data && data.rider) || null;
      cacheUser(user);
      return user;
    } catch (err) {
      if (err && err.status === 401) {
        clearAuth();
      }
      return null;
    }
  }

  /**
   * Where should a freshly-logged-in user land?
   *
   *   admin   → existing admin dashboard on the API host (we don't
   *             re-build admin on Vercel; it stays on Railway).
   *   driver  → their own public profile, which doubles as their
   *             "share this URL with potential riders" page. Username
   *             is unique on `riders.username`.
   *   rider   → /account, which surfaces ride history + receipt
   *             download (the "rider tool").
   *
   * `both` users (rare — drivers who also use the rider app) get the
   * driver landing since the rider tool is reachable from /account
   * via the nav anyway.
   */
  function routeAfterAuth(user) {
    if (!user) return "/login";
    if (user.role === "admin") return API_BASE + "/admin";
    if (user.userType === "driver" || user.userType === "both") {
      if (user.username) return "/" + encodeURIComponent(user.username);
      return "/account";
    }
    return "/account";
  }

  // Public surface
  global.JoyrideAPI = {
    API_BASE: API_BASE,
    getToken: getToken,
    setToken: setToken,
    cacheUser: cacheUser,
    readCachedUser: readCachedUser,
    clearAuth: clearAuth,
    apiGet: apiGet,
    apiPost: apiPost,
    loadCurrentUser: loadCurrentUser,
    routeAfterAuth: routeAfterAuth,
  };
})(window);
