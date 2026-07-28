/**
 * Unit tests for api/signup.js — the Turnstile gate in front of the
 * Railway rider-signup endpoint.
 *
 * Run: node --test joyride-website/api/signup.test.cjs
 *
 * Every accepted signup costs an email + an SMS, so the behaviour worth
 * pinning is that a bot never reaches upstream, and that the proxy
 * neither leaks the token upstream nor lets a caller smuggle extra
 * fields into the signup payload.
 */
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const handler = require("./signup.js");

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
  firstName: "Jane",
  lastName: "Rider",
  email: "jane@example.com",
  mobile: "6505551234",
  username: "janerider",
  password: "hunter2hunter2",
  turnstileToken: "tok_abc",
};

const UPSTREAM_OK = { sessionToken: "sess_xyz", rider: { id: 42, username: "janerider" } };

function stubFetch({ turnstileOk = true, upstreamStatus = 200, upstreamBody = UPSTREAM_OK } = {}) {
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

test("should_pass_the_session_response_through_untouched_on_success", async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq(GOOD), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, UPSTREAM_OK, "login.html reads sessionToken + rider from this");
  assert.ok(calls[1].url.endsWith("/api/rider/signup"));
});

test("should_never_reach_upstream_when_turnstile_fails", async () => {
  const calls = stubFetch({ turnstileOk: false });
  const res = makeRes();
  await handler(makeReq(GOOD), res);

  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 1, "no account may be created for a failed bot check");
});

test("should_reject_with_400_when_the_token_is_missing", async () => {
  const calls = stubFetch();
  const res = makeRes();
  const { turnstileToken, ...noToken } = GOOD;
  await handler(makeReq(noToken), res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("should_fail_closed_when_siteverify_throws", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("siteverify")) throw new Error("network down");
    return { status: 200, json: async () => UPSTREAM_OK };
  };
  const res = makeRes();
  await handler(makeReq(GOOD), res);
  assert.equal(res.statusCode, 403);
});

test("should_not_forward_the_turnstile_token_upstream", async () => {
  const calls = stubFetch();
  await handler(makeReq(GOOD), makeRes());
  const sent = JSON.parse(calls[1].opts.body);
  assert.equal(sent.turnstileToken, undefined);
});

test("should_forward_only_allowlisted_fields", async () => {
  const calls = stubFetch();
  await handler(
    makeReq({ ...GOOD, role: "admin", userType: "driver", isAdmin: true }),
    makeRes()
  );
  const sent = JSON.parse(calls[1].opts.body);
  // A caller must not be able to smuggle privileged fields through the
  // proxy into an endpoint that might one day trust them.
  assert.equal(sent.role, undefined);
  assert.equal(sent.userType, undefined);
  assert.equal(sent.isAdmin, undefined);
  assert.equal(sent.email, "jane@example.com");
  assert.equal(sent.password, "hunter2hunter2");
});

test("should_forward_affid_when_present_and_omit_it_when_not", async () => {
  let calls = stubFetch();
  await handler(makeReq({ ...GOOD, affid: "dave" }), makeRes());
  assert.equal(JSON.parse(calls[1].opts.body).affid, "dave");

  calls = stubFetch();
  await handler(makeReq(GOOD), makeRes());
  assert.equal("affid" in JSON.parse(calls[1].opts.body), false);
});

test("should_pass_upstream_errors_through_unchanged", async () => {
  for (const [status, body] of [
    [400, { error: "That username is already taken." }],
    [409, { error: "An account with that email already exists." }],
    [500, { error: "Signup failed." }],
  ]) {
    stubFetch({ upstreamStatus: status, upstreamBody: body });
    const res = makeRes();
    await handler(makeReq(GOOD), res);
    assert.equal(res.statusCode, status);
    assert.deepEqual(res.body, body);
  }
});

test("should_return_502_when_upstream_throws", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("siteverify")) return { ok: true, json: async () => ({ success: true }) };
    throw new Error("ECONNREFUSED");
  };
  const res = makeRes();
  await handler(makeReq(GOOD), res);
  assert.equal(res.statusCode, 502);
});

test("should_skip_the_bot_check_when_the_secret_is_unset", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  const calls = stubFetch();
  const res = makeRes();
  const { turnstileToken, ...noToken } = GOOD;
  await handler(makeReq(noToken), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
});

test("should_405_on_non_POST", async () => {
  const res = makeRes();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
});
