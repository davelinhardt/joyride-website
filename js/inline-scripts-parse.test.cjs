/**
 * Minimum smoke test for every joyride.cool HTML page:
 *   "The inline <script> blocks parse without a syntax error."
 *
 * A syntax error inside an inline script kills the entire script
 * silently (no .js file in DevTools' Sources to inspect, just a
 * blank page once the JS-required UI fails to render). This caught
 * the 2026-05-21 admin.html port: an extracted template literal
 * left `\\` doubles in place, which broke string literals like
 * `'riders haven\\'t left feedback'` and prevented the whole inline
 * <script> from running. Symptom: blank /admin page.
 *
 * Run: node --test joyride-website/js/inline-scripts-parse.test.cjs
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const WEBSITE_DIR = path.resolve(__dirname, "..");
const PAGES = ["index.html", "login.html", "account.html", "rides.html", "receipt.html", "admin.html", "driver.html", "blog.html", "contact.html", "drivers.html", "riders.html", "design-system.html"];

function extractInlineScripts(html) {
  // Match each <script> tag without a `src=` attribute. Bodies can be
  // empty (open + close on the same line) — node --check tolerates
  // an empty input so we still verify the tag exists.
  const tagRe = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  const out = [];
  for (const m of html.matchAll(tagRe)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
}

function parseChecks(scriptBody, label) {
  const tmp = path.join(os.tmpdir(), `joyride-inline-${process.pid}-${Math.random().toString(36).slice(2, 8)}.js`);
  // Wrap in an IIFE so top-level `await` (some pages use it) is legal
  // — node --check would otherwise reject `await` outside a module.
  const wrapped = "(async function () {\n" + scriptBody + "\n})();\n";
  fs.writeFileSync(tmp, wrapped, "utf8");
  try {
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : "";
    throw new Error(`syntax error in ${label}:\n${stderr.split("\n").slice(0, 8).join("\n")}`);
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

for (const page of PAGES) {
  const p = path.join(WEBSITE_DIR, page);
  if (!fs.existsSync(p)) continue;
  test(`${page}: inline scripts parse`, () => {
    const html = fs.readFileSync(p, "utf8");
    const scripts = extractInlineScripts(html);
    assert.ok(scripts.length >= 0, "extraction returned a list");
    for (let i = 0; i < scripts.length; i++) {
      const body = scripts[i].trim();
      if (!body) continue;
      parseChecks(body, `${page} inline #${i}`);
    }
  });
}
