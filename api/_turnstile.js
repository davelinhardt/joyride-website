/**
 * Shared Cloudflare Turnstile verification for the Vercel functions.
 *
 * Underscore prefix so Vercel doesn't expose it as a route — it's a
 * library, not an endpoint.
 *
 * Both /api/contact and /api/signup gate on this. It lives in one place
 * deliberately: a bot check duplicated across two files is a check that
 * eventually gets fixed in one of them.
 *
 * Verification happens on Vercel rather than on the Railway API because
 * TURNSTILE_SECRET_KEY already lives in the Vercel project (it backs the
 * /join kiosk) and Vercel masks it on read, so it can't be copied to
 * Railway without a manual paste.
 *
 * Fails CLOSED: a thrown siteverify is treated as a failed check, never
 * as a pass. The one exception is a missing secret, which is a
 * misconfiguration — there we skip the check and log loudly rather than
 * break signup and the contact form entirely. That matches the
 * behaviour api/waitlist.js has had in production.
 */

"use strict";

var TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Parse a body that may arrive already-parsed or as a raw JSON string. */
function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (_) {
      return {};
    }
  }
  return typeof body === "object" ? body : {};
}

/** First IP from x-forwarded-for, passed to Turnstile as remoteip. */
function getClientIp(req) {
  var xff = req && req.headers && req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return "";
}

/**
 * Verify a token with Cloudflare's siteverify endpoint.
 * Resolves true only when Cloudflare confirms the token is valid.
 */
async function verifyTurnstile(token, secret, remoteip) {
  var form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteip) form.append("remoteip", remoteip);
  var res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  var data = await res.json();
  return !!(data && data.success);
}

/**
 * Gate a request on Turnstile.
 *
 * Returns null when the caller may proceed, or { status, error } to send
 * back. `label` only appears in logs.
 */
async function checkTurnstile(req, body, label) {
  var secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("[" + label + "] TURNSTILE_SECRET_KEY not set — skipping bot check.");
    return null;
  }
  var token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (!token) {
    return { status: 400, error: "Please complete the verification and try again." };
  }
  var ok = false;
  try {
    ok = await verifyTurnstile(token, secret, getClientIp(req));
  } catch (err) {
    console.error("[" + label + "] Turnstile verify threw", err);
  }
  if (!ok) {
    return { status: 403, error: "Verification failed. Please try again." };
  }
  return null;
}

module.exports = { parseBody, getClientIp, verifyTurnstile, checkTurnstile };
