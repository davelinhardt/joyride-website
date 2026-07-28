/**
 * Unit tests for api/contact.js — the Turnstile gate in front of the
 * Railway inquiries endpoint.
 *
 * Run: node --test joyride-website/api/contact.test.cjs
 *
 * The handler is exercised end-to-end with fetch stubbed, because the
 * behaviour worth pinning is the *order* of operations: a bot must be
 * rejected before we ever touch the upstream API, and a failed
 * Turnstile check must never result in a stored inquiry.
 */
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const handler = require("./contact.js");
const { parseBody, getClientIp } = require("./contact.js");

const realFetch = global.fetch;
const realSecret = process.env.TURNSTILE_SECRET_KEY;

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

function makeReq(body, headers) {
  return { method: "POST", body: body, headers: headers || {} };
}

const GOOD = {
  name: "Jane Rider",
  email: "jane@example.com",
  subject: "Book a ride",
  message: "Do you cover RDU?",
  turnstileToken: "tok_abc",
};

/** Stub fetch: first call is Turnstile siteverify, second is upstream. */
function stubFetch({ turnstileOk = true, upstreamStatus = 201, upstreamBody = { ok: true, id: 7 } } = {}) {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes("siteverify")) {
      return { ok: true, json: async () => ({ success: turnstileOk }) };
    }
    return { status: upstreamStatus, json: async () => upstreamBody };
  };
  return calls;
}

beforeEach(() => {
  process.env.TURNSTILE_SECRET_KEY = "secret_test";
});
afterEach(() => {
  global.fetch = realFetch;
  if (realSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = realSecret;
});

test("parseBody handles objects, JSON strings, and garbage", () => {
  assert.deepEqual(parseBody({ a: 1 }), { a: 1 });
  assert.deepEqual(parseBody('{"a":1}'), { a: 1 });
  assert.deepEqual(parseBody("not json"), {});
  assert.deepEqual(parseBody(undefined), {});
  assert.deepEqual(parseBody(null), {});
});

test("getClientIp takes the first hop of x-forwarded-for", () => {
  assert.equal(getClientIp({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }), "1.2.3.4");
  assert.equal(getClientIp({ headers: {} }), "");
});

test("should_forward_to_upstream_when_turnstile_passes", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq(GOOD), res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { ok: true, id: 7 });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes("siteverify"));
  assert.ok(calls[1].url.endsWith("/api/public/contact"));
});

test("should_not_send_turnstileToken_upstream", async () => {
  const calls = stubFetch();
  await handler(makeReq(GOOD), makeRes());
  const forwarded = JSON.parse(calls[1].opts.body);
  assert.equal(forwarded.turnstileToken, undefined);
  assert.equal(forwarded.name, "Jane Rider");
});

test("should_forward_the_real_client_ip_so_the_upstream_limiter_buckets_correctly", async () => {
  const calls = stubFetch();
  await handler(makeReq(GOOD, { "x-forwarded-for": "9.9.9.9, 10.0.0.1" }), makeRes());
  assert.equal(calls[1].opts.headers["x-forwarded-for"], "9.9.9.9");
});

test("should_reject_with_403_and_never_call_upstream_when_turnstile_fails", async () => {
  const calls = stubFetch({ turnstileOk: false });
  const res = makeRes();
  await handler(makeReq(GOOD), res);

  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 1, "upstream must not be called for a failed bot check");
});

test("should_reject_with_400_when_the_token_is_missing", async () => {
  const calls = stubFetch();
  const res = makeRes();
  const { turnstileToken, ...noToken } = GOOD;
  await handler(makeReq(noToken), res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0, "no network calls at all without a token");
});

test("should_treat_a_thrown_siteverify_as_a_failed_check", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("siteverify")) throw new Error("network down");
    return { status: 201, json: async () => ({ ok: true }) };
  };
  const res = makeRes();
  await handler(makeReq(GOOD), res);
  assert.equal(res.statusCode, 403, "fail closed, not open");
});

test("should_skip_the_bot_check_when_the_secret_is_unset", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  const calls = stubFetch();
  const res = makeRes();
  const { turnstileToken, ...noToken } = GOOD;
  await handler(makeReq(noToken), res);

  // A missing secret is a misconfiguration; degrade to "no bot check"
  // rather than breaking the contact form entirely.
  assert.equal(res.statusCode, 201);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/api/public/contact"));
});

test("should_pass_upstream_status_and_body_through_unchanged", async () => {
  for (const [status, body] of [
    [400, { error: "Name, email, and message are required." }],
    [429, { error: "Too many messages from this connection. Please try again later." }],
    [500, { error: "Could not send your message. Please try again." }],
  ]) {
    stubFetch({ upstreamStatus: status, upstreamBody: body });
    const res = makeRes();
    await handler(makeReq(GOOD), res);
    assert.equal(res.statusCode, status);
    assert.deepEqual(res.body, body);
  }
});

test("should_return_502_when_the_upstream_request_throws", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("siteverify")) return { ok: true, json: async () => ({ success: true }) };
    throw new Error("ECONNREFUSED");
  };
  const res = makeRes();
  await handler(makeReq(GOOD), res);
  assert.equal(res.statusCode, 502);
});

test("should_405_on_non_POST", async () => {
  const res = makeRes();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});
