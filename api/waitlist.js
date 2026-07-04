/**
 * /api/waitlist — Vercel serverless function.
 *
 * Public endpoint (allow-listed past the Basic-Auth gate in
 * middleware.js) that the /join kiosk page POSTs a single email to.
 * It proxies the subscribe to Beehiiv's v2 API server-side so the
 * Beehiiv API key NEVER ships to the iPad in the back seat.
 *
 * Env (set in Vercel → Project → Settings → Environment Variables):
 *   BEEHIIV_API_KEY         — Beehiiv API key (secret)
 *   BEEHIIV_PUBLICATION_ID  — e.g. "pub_xxxxxxxx-xxxx-xxxx-..."
 *
 * Contract:
 *   Request : POST { "email": "you@example.com" }
 *   Success : 200 { ok: true }
 *   Bad email: 400 { ok: false, error: "..." }
 *   Misconfig/ upstream failure: 502/500 { ok: false, error: "..." }
 *
 * CommonJS (module.exports) on purpose: (a) Vercel runs it as a Node
 * serverless function, and (b) the pure helpers below are unit-tested
 * from api/waitlist.test.cjs with `require()`.
 */

"use strict";

var BEEHIIV_API_BASE = "https://api.beehiiv.com/v2";

/**
 * Conservative email sanity check. Not RFC-5322 exhaustive — just
 * enough to reject the obvious garbage a fat-fingered backseat tap
 * produces before we spend a network round-trip on Beehiiv. Beehiiv
 * does the authoritative validation on its end.
 */
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  var trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // single @, non-empty local part, a dot-something TLD in the domain,
  // and no whitespace anywhere.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

/**
 * Build the Beehiiv subscription payload. Tagged with UTM + referrer
 * so Dave can see in Beehiiv which signups came from the Tesla kiosk
 * vs. the website. reactivate_existing:true means a passenger who
 * already unsubscribed once gets quietly re-added rather than erroring.
 */
function buildBeehiivPayload(email) {
  return {
    email: String(email).trim().toLowerCase(),
    reactivate_existing: true,
    send_welcome_email: false,
    utm_source: "tesla-kiosk",
    utm_medium: "ipad-headrest",
    utm_campaign: "rider-waitlist",
    referring_site: "joyride.cool/join",
  };
}

/**
 * Beehiiv publication IDs are `pub_<uuid>`. The dashboard sometimes
 * surfaces the bare UUID, so be forgiving: prepend `pub_` when it's
 * missing. Returns "" for empty/undefined input.
 */
function normalizePublicationId(pubId) {
  if (!pubId || typeof pubId !== "string") return "";
  var trimmed = pubId.trim();
  if (!trimmed) return "";
  return trimmed.indexOf("pub_") === 0 ? trimmed : "pub_" + trimmed;
}

/**
 * Pull the email out of a Vercel request body that may arrive already
 * parsed (object) or as a raw JSON string, depending on headers.
 */
function extractEmail(body) {
  if (!body) return "";
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return "";
    }
  }
  return body && typeof body.email === "string" ? body.email : "";
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  var email = extractEmail(req.body);
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "Please enter a valid email address." });
    return;
  }

  var apiKey = process.env.BEEHIIV_API_KEY;
  var pubId = normalizePublicationId(process.env.BEEHIIV_PUBLICATION_ID);
  if (!apiKey || !pubId) {
    // Misconfiguration — surface it clearly in logs but don't leak
    // which var is missing to the client.
    console.error("[waitlist] Missing BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID env var.");
    res.status(500).json({ ok: false, error: "Signup is temporarily unavailable." });
    return;
  }

  try {
    var upstream = await fetch(
      BEEHIIV_API_BASE + "/publications/" + encodeURIComponent(pubId) + "/subscriptions",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildBeehiivPayload(email)),
      }
    );

    if (upstream.ok) {
      res.status(200).json({ ok: true });
      return;
    }

    var detail = "";
    try {
      detail = JSON.stringify(await upstream.json());
    } catch (_) {
      /* non-JSON upstream body — ignore */
    }
    console.error("[waitlist] Beehiiv error", upstream.status, detail);
    res.status(502).json({ ok: false, error: "Couldn't reach the signup service. Please try again." });
  } catch (err) {
    console.error("[waitlist] fetch threw", err);
    res.status(502).json({ ok: false, error: "Couldn't reach the signup service. Please try again." });
  }
}

module.exports = handler;
module.exports.isValidEmail = isValidEmail;
module.exports.buildBeehiivPayload = buildBeehiivPayload;
module.exports.extractEmail = extractEmail;
module.exports.normalizePublicationId = normalizePublicationId;
