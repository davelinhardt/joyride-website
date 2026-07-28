/**
 * Contact-form proxy — Cloudflare Turnstile gate in front of the
 * Railway inquiries endpoint.
 *
 * Why this sits on Vercel rather than talking to Railway directly:
 * TURNSTILE_SECRET_KEY already lives in the Vercel project (it backs the
 * /join kiosk), and Vercel masks it on read — so it can't be copied to
 * Railway without a manual paste. Verifying here reuses the secret where
 * it already is, mirrors the proven api/waitlist.js pattern, and keeps
 * the browser on a same-origin POST (no CORS preflight).
 *
 * The Railway endpoint stays publicly reachable, so a bot that skips
 * this proxy can still hit it directly. That path is covered by the
 * per-IP rate limit inside public-routes.ts — this proxy is the bot
 * gate, that limiter is the backstop. To collapse the two, put
 * TURNSTILE_SECRET_KEY on Railway and verify there instead.
 *
 * Env:
 *   TURNSTILE_SECRET_KEY — Cloudflare Turnstile secret. If unset the bot
 *                          check is skipped and logged, so a
 *                          misconfiguration degrades to "no bot check"
 *                          rather than "contact form is broken."
 *   JOYRIDE_API_BASE     — override the upstream API (defaults to prod).
 *
 * Contract:
 *   Request : POST { name, email, subject, message, sourcePage, turnstileToken }
 *   Success : 201 { ok: true, id }
 *   Bad input      : 400 { error }   (passed through from upstream)
 *   Failed bot check: 403 { error }
 *   Rate limited   : 429 { error }   (passed through from upstream)
 *
 * CommonJS on purpose — matches api/waitlist.js so the pure helpers are
 * unit-testable with require() from api/contact.test.cjs.
 */

"use strict";

var TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
var DEFAULT_API_BASE = "https://joiryde-api-production.up.railway.app";

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
 * Verify a Turnstile token with Cloudflare's siteverify endpoint.
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

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  var body = parseBody(req.body);

  // Bot check first — no point spending an upstream round-trip on a bot.
  var turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    var token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
    if (!token) {
      res.status(400).json({ error: "Please complete the verification and try again." });
      return;
    }
    var humanVerified = false;
    try {
      humanVerified = await verifyTurnstile(token, turnstileSecret, getClientIp(req));
    } catch (err) {
      console.error("[contact] Turnstile verify threw", err);
    }
    if (!humanVerified) {
      res.status(403).json({ error: "Verification failed. Please try again." });
      return;
    }
  } else {
    console.warn("[contact] TURNSTILE_SECRET_KEY not set — skipping bot check.");
  }

  var apiBase = process.env.JOYRIDE_API_BASE || DEFAULT_API_BASE;
  try {
    var upstream = await fetch(apiBase + "/api/public/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the caller's IP so the upstream limiter buckets by the
        // real visitor rather than by this function's egress address —
        // otherwise every submission shares one bucket and the first
        // handful of legitimate messages exhaust it for everyone.
        "x-forwarded-for": getClientIp(req),
      },
      body: JSON.stringify({
        name: body.name,
        email: body.email,
        subject: body.subject,
        message: body.message,
        sourcePage: body.sourcePage,
      }),
    });
    var data = await upstream.json().catch(function () {
      return {};
    });
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[contact] Upstream request failed", err);
    res.status(502).json({ error: "Could not send your message. Please try again." });
  }
}

module.exports = handler;
module.exports.parseBody = parseBody;
module.exports.getClientIp = getClientIp;
module.exports.verifyTurnstile = verifyTurnstile;
