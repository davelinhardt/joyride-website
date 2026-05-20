/**
 * Unit tests for the /account verification-modal decision logic.
 * Run: node --test joyride-website/js/verify-modal-logic.test.cjs
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const logic = require("./verify-modal-logic.js");

const { shouldOpenVerifyModal, shouldCloseVerifyModal } = logic;

// ─── shouldOpenVerifyModal ─────────────────────────────────────────────────

test("fresh signup (both flags false) + ?verify=1 → opens modal", () => {
  const user = { emailVerified: false, mobileVerified: false };
  assert.equal(shouldOpenVerifyModal("?verify=1", user), true);
});

test("only email unverified + ?verify=1 → opens modal", () => {
  const user = { emailVerified: false, mobileVerified: true };
  assert.equal(shouldOpenVerifyModal("?verify=1", user), true);
});

test("only mobile unverified + ?verify=1 → opens modal", () => {
  const user = { emailVerified: true, mobileVerified: false };
  assert.equal(shouldOpenVerifyModal("?verify=1", user), true);
});

test("fully verified + ?verify=1 → does NOT open modal", () => {
  const user = { emailVerified: true, mobileVerified: true };
  assert.equal(shouldOpenVerifyModal("?verify=1", user), false);
});

test("fresh signup but NO ?verify param → does NOT open modal", () => {
  const user = { emailVerified: false, mobileVerified: false };
  assert.equal(shouldOpenVerifyModal("", user), false);
});

test("fresh signup with unrelated query string → does NOT open modal", () => {
  const user = { emailVerified: false, mobileVerified: false };
  assert.equal(shouldOpenVerifyModal("?foo=bar", user), false);
});

test("?verify=0 explicitly → does NOT open modal", () => {
  const user = { emailVerified: false, mobileVerified: false };
  assert.equal(shouldOpenVerifyModal("?verify=0", user), false);
});

test("null user → does NOT open modal", () => {
  assert.equal(shouldOpenVerifyModal("?verify=1", null), false);
});

test("undefined user → does NOT open modal", () => {
  assert.equal(shouldOpenVerifyModal("?verify=1", undefined), false);
});

test("malformed search string → does NOT open modal (no throw)", () => {
  const user = { emailVerified: false, mobileVerified: false };
  // URLSearchParams is forgiving; this still parses cleanly.
  assert.equal(shouldOpenVerifyModal("not a real query", user), false);
});

// ─── shouldCloseVerifyModal ────────────────────────────────────────────────

test("fully verified + ?verify=1 → close-and-strip-param", () => {
  const user = { emailVerified: true, mobileVerified: true };
  assert.equal(shouldCloseVerifyModal("?verify=1", user), true);
});

test("partially verified + ?verify=1 → does NOT close (modal stays open)", () => {
  const user = { emailVerified: true, mobileVerified: false };
  assert.equal(shouldCloseVerifyModal("?verify=1", user), false);
});

test("fully verified WITHOUT ?verify=1 → no action", () => {
  const user = { emailVerified: true, mobileVerified: true };
  assert.equal(shouldCloseVerifyModal("", user), false);
});

test("null user → does NOT trigger close", () => {
  assert.equal(shouldCloseVerifyModal("?verify=1", null), false);
});

// ─── Mutually-exclusive sanity check ──────────────────────────────────────

test("open and close are never both true for the same input", () => {
  const states = [
    { emailVerified: false, mobileVerified: false },
    { emailVerified: false, mobileVerified: true },
    { emailVerified: true, mobileVerified: false },
    { emailVerified: true, mobileVerified: true },
  ];
  const searches = ["?verify=1", "?verify=0", "", "?foo=bar"];
  for (const user of states) {
    for (const search of searches) {
      const open = shouldOpenVerifyModal(search, user);
      const close = shouldCloseVerifyModal(search, user);
      assert.equal(
        open && close,
        false,
        `open && close both true for user=${JSON.stringify(user)} search=${search}`,
      );
    }
  }
});
