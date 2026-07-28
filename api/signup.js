/**
 * Signup proxy — Cloudflare Turnstile gate in front of the Railway
 * rider-signup endpoint.
 *
 * Why this matters more than the contact form: every accepted signup
 * fires a verification email (Resend) AND an SMS (Twilio), so scripted
 * account creation costs real money per attempt and pollutes the riders
 * table. Before this, /api/rider/signup was a wide-open public POST.
 *
 * Why the gate sits on Vercel: TURNSTILE_SECRET_KEY lives in the Vercel
 * project (it backs /join and /api/contact) and Vercel masks it on read,
 * so it can't be copied to Railway without a manual paste. See
 * api/_turnstile.js.
 *
 * NOTE: /api/rider/signup on Railway is still directly reachable — this
 * proxy is a gate on the front door, not a lock on the endpoint. To make
 * it airtight, either put TURNSTILE_SECRET_KEY on Railway and verify in
 * rider-auth.ts, or add the same per-IP limiter the contact endpoint
 * uses. Called out so it's a known gap, not an assumed one.
 *
 * The upstream response (sessionToken + rider) is passed through
 * verbatim — login.html stores the token exactly as it did when it
 * posted to Railway directly. This proxy does not read, log, or persist
 * credentials; it forwards the body and returns the reply.
 *
 * Contract:
 *   Request : POST { firstName, lastName, email, mobile, username,
 *                    password, affid?, turnstileToken }
 *   Success : 200 { sessionToken, rider }
 *   Failed bot check: 403 { error }
 *   Everything else : upstream status + body, unchanged
 */

"use strict";

var { parseBody, getClientIp, checkTurnstile } = require("./_turnstile.js");

var DEFAULT_API_BASE = "https://joiryde-api-production.up.railway.app";

/**
 * Fields forwarded upstream. An explicit allowlist rather than a
 * spread: it keeps turnstileToken out of the signup payload and means a
 * caller can't smuggle extra fields (role, userType, …) through the
 * proxy into an endpoint that might one day trust them.
 */
var FORWARD_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "mobile",
  "username",
  "password",
  "affid",
];

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  var body = parseBody(req.body);

  var gate = await checkTurnstile(req, body, "signup");
  if (gate) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

  var payload = {};
  FORWARD_FIELDS.forEach(function (k) {
    if (body[k] !== undefined) payload[k] = body[k];
  });

  var apiBase = process.env.JOYRIDE_API_BASE || DEFAULT_API_BASE;
  try {
    var upstream = await fetch(apiBase + "/api/rider/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": getClientIp(req),
      },
      body: JSON.stringify(payload),
    });
    var data = await upstream.json().catch(function () {
      return {};
    });
    res.status(upstream.status).json(data);
  } catch (err) {
    // Deliberately does not log the payload — it contains a password.
    console.error("[signup] Upstream request failed", err && err.message);
    res.status(502).json({ error: "Could not create your account. Please try again." });
  }
}

module.exports = handler;
module.exports.FORWARD_FIELDS = FORWARD_FIELDS;
