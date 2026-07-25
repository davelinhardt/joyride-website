/**
 * Unit tests for the site password gate (middleware.js).
 *
 * Run: node --test joyride-website/middleware.test.mjs
 *
 * WHY THESE EXIST
 * The "second password gate on /rider" bug came back three times, from three
 * different causes (the app fetching joyride.cool/api/*, a root-level
 * /manifest.json, browser-autofetched icons). Every fix was another entry in
 * PUBLIC_PATHS, and every time a path nobody thought of reopened it.
 *
 * The rule that actually closes it: a browser only pops its password dialog on
 * a 401 that carries `WWW-Authenticate`. Send that header for real page
 * navigations; never for subresources. Then no request the rider app makes can
 * produce a password prompt, whatever path it hits.
 *
 * These tests pin both halves — the gate still challenges real visitors, and
 * it can never challenge a subresource.
 *
 * middleware.js is ESM in a directory with no package.json "type", so Node
 * would parse it as CommonJS. Importing the source through a data: URL gets it
 * evaluated as a module without needing to restructure the site.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./middleware.js", import.meta.url), "utf8");
const { default: middleware } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

const PASSWORD = "test-password-not-the-real-one";
process.env.SITE_PASSWORD = PASSWORD;

function req(pathname, { headers = {}, password } = {}) {
  const h = { ...headers };
  if (password !== undefined) {
    h.authorization = "Basic " + Buffer.from("anyuser:" + password).toString("base64");
  }
  return new Request("https://joyride.cool" + pathname, { headers: h });
}

/** A top-level page load, as a modern browser sends it. */
const NAVIGATION = { "sec-fetch-mode": "navigate", accept: "text/html,application/xhtml+xml" };
/** An app's fetch()/XHR — the case that must never prompt. */
const SUBRESOURCE = { "sec-fetch-mode": "cors", accept: "application/json" };

test("gate lets exempt paths through untouched", () => {
  for (const p of ["/rider", "/login", "/account", "/raise1", "/join", "/favicon.ico"]) {
    assert.equal(middleware(req(p)), undefined, p + " should bypass the gate");
  }
});

test("gate lets every /rider/* asset through — the web app is never gated", () => {
  for (const p of [
    "/rider/manifest.webmanifest",
    "/rider/apple-touch-icon.png",
    "/rider/_expo/static/js/web/entry-abc123.js",
    "/rider/(tabs)/profile",
  ]) {
    assert.equal(middleware(req(p)), undefined, p + " should bypass the gate");
  }
});

test("gate lets a correct password through", () => {
  assert.equal(middleware(req("/", { headers: NAVIGATION, password: PASSWORD })), undefined);
});

test("gate blocks a wrong password", async () => {
  const res = middleware(req("/", { headers: NAVIGATION, password: "wrong" }));
  assert.equal(res.status, 401);
});

test("a real page navigation DOES get the password prompt", () => {
  const res = middleware(req("/", { headers: NAVIGATION }));
  assert.equal(res.status, 401);
  assert.match(res.headers.get("www-authenticate") ?? "", /^Basic realm=/);
});

test("a subresource fetch gets 401 but NO prompt", () => {
  // This is the whole fix. A 401 here still serves no content, but without the
  // challenge header the browser cannot pop a dialog over the loaded app.
  const res = middleware(req("/api/rider/me", { headers: SUBRESOURCE }));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("www-authenticate"), null);
});

test("no subresource destination can produce a prompt", () => {
  // Deliberately a NON-exempt path — an exempt one would bypass the gate and
  // prove nothing about the challenge header.
  for (const mode of ["cors", "no-cors", "same-origin", "websocket"]) {
    const res = middleware(req("/some-unlisted-endpoint", { headers: { "sec-fetch-mode": mode } }));
    assert.equal(res.status, 401);
    assert.equal(
      res.headers.get("www-authenticate"),
      null,
      "sec-fetch-mode=" + mode + " must not be challenged",
    );
  }
});

test("falls back to Accept when Sec-Fetch-Mode is absent (older browsers)", () => {
  // Without a fallback, an old browser would get no challenge and the gate
  // would silently stop working for real visitors.
  const doc = middleware(req("/", { headers: { accept: "text/html,application/xhtml+xml" } }));
  assert.match(doc.headers.get("www-authenticate") ?? "", /^Basic realm=/);

  const xhr = middleware(req("/api/rider/me", { headers: { accept: "application/json" } }));
  assert.equal(xhr.headers.get("www-authenticate"), null);

  const bare = middleware(req("/some-asset.png", { headers: {} }));
  assert.equal(bare.headers.get("www-authenticate"), null);
});

test("gated content is still withheld regardless of prompt suppression", () => {
  // Suppressing the header must not turn into serving the page.
  for (const headers of [NAVIGATION, SUBRESOURCE]) {
    const res = middleware(req("/drivers", { headers }));
    assert.equal(res.status, 401);
  }
});
