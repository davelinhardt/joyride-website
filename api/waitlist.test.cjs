/**
 * Unit tests for the pure logic in api/waitlist.js.
 *
 * Run: node --test joyride-website/api/waitlist.test.cjs
 *
 * We only exercise the pure helpers (email validation, payload
 * shaping, body extraction) — the network call to Beehiiv is not
 * unit-tested here; that's an integration concern verified live
 * after the env vars are set.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidEmail,
  buildBeehiivPayload,
  extractEmail,
  normalizePublicationId,
} = require("./waitlist.js");

test("isValidEmail accepts normal addresses", () => {
  assert.equal(isValidEmail("dave@insightstudios.co"), true);
  assert.equal(isValidEmail("a.b-c+tag@sub.example.com"), true);
  assert.equal(isValidEmail("  trimmed@example.com  "), true);
});

test("isValidEmail rejects garbage a backseat tap produces", () => {
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("nope"), false);
  assert.equal(isValidEmail("no@domain"), false);
  assert.equal(isValidEmail("no spaces@example.com"), false);
  assert.equal(isValidEmail("two@@example.com"), false);
  assert.equal(isValidEmail("@example.com"), false);
  assert.equal(isValidEmail("trailing@dot."), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(undefined), false);
  assert.equal(isValidEmail(12345), false);
});

test("buildBeehiivPayload normalizes email and tags the source", () => {
  const p = buildBeehiivPayload("  Dave@Example.COM ");
  assert.equal(p.email, "dave@example.com");
  assert.equal(p.reactivate_existing, true);
  assert.equal(p.send_welcome_email, false);
  assert.equal(p.utm_source, "tesla-kiosk");
  assert.equal(p.utm_medium, "ipad-headrest");
  assert.equal(p.utm_campaign, "rider-waitlist");
  assert.equal(p.referring_site, "joyride.cool/join");
});

test("normalizePublicationId adds the pub_ prefix when missing", () => {
  const uuid = "51b404e6-2f4e-4121-a59b-8f3e4a08f320";
  assert.equal(normalizePublicationId(uuid), "pub_" + uuid);
  assert.equal(normalizePublicationId("pub_" + uuid), "pub_" + uuid);
  assert.equal(normalizePublicationId("  " + uuid + "  "), "pub_" + uuid);
  assert.equal(normalizePublicationId(""), "");
  assert.equal(normalizePublicationId(undefined), "");
  assert.equal(normalizePublicationId(null), "");
});

test("extractEmail handles parsed objects and raw JSON strings", () => {
  assert.equal(extractEmail({ email: "x@y.com" }), "x@y.com");
  assert.equal(extractEmail('{"email":"x@y.com"}'), "x@y.com");
  assert.equal(extractEmail(""), "");
  assert.equal(extractEmail(null), "");
  assert.equal(extractEmail("not json"), "");
  assert.equal(extractEmail({ nope: 1 }), "");
});
