# joyride-website

Marketing + auth website for Joyride, deployed at https://joyride.cool/.

Static HTML/CSS/JS hosted on Vercel, talking to the joiryde-api Railway backend
for login / signup / driver profiles / rider tool.

## Structure

- `index.html` — landing
- `riders.html` — marketing for riders
- `drivers.html` — marketing for drivers
- `login.html` — auth (login + signup tabs, mirrors the rider app signup flow)
- `account.html` — post-login chooser (rider tools / driver profile if approved / admin tool / download apps) + email + mobile verification (inline widget + post-signup modal)
- `driver.html` — public driver profile served at `/{username}`
- `rides.html` — rider's ride history (Activity tab mirror)
- `receipt.html` — single-ride receipt with Print/Save-as-PDF
- `blog.html`, `contact.html`, `design-system.html`
- `styles.css`, `site.js`, `js/api.js`
- `vercel.json` — security headers, rewrites for known pages + `/{username}` catch-all, narrow immutable cache rule (image prefixes only)

## Deploy

Pushed to GitHub → Vercel auto-deploys main. CLI:

```
vercel --prod
```

## Caching gotcha

**Never put JS or HTML behind the `immutable, max-age=31536000` rule
in `vercel.json`.** The rule's `source` pattern is intentionally
narrowed to specific image/font subdirectories
(`illo|lockup|mark|wordmark|favicon|fonts|img|images`) precisely
because `api.js` got cached for a year with a syntax error on
2026-05-19 and there was no way to bust it short of changing the URL.
Anything that might ever change — JS, CSS bundles, configuration —
should live outside that pattern so Vercel's default
`max-age=0, must-revalidate` applies and the browser revalidates on
every request. `api.js` lives at `/js/api.js` for this reason — out
of `/assets/` (so the immutable rule doesn't apply) and under a
two-segment path (so the `/{username}` catch-all rewrite doesn't
try to interpret it as a driver slug). **Don't move it back into
`/assets/`, and don't put it at the root (`/api.js`) — the catch-all
will eat it.**

## Routing

- Known pages are served from their own `.html` files via `cleanUrls`
  (so `/login` → `login.html`, `/account` → `account.html`, etc.).
- **Public driver profiles live at `joyride.cool/{username}`.** A
  `vercel.json` rewrite maps any single-segment URL that *doesn't*
  match a known page or asset to `/driver.html?u={slug}`. The negative
  lookahead in the source pattern lists every known page name plus
  `assets` and `favicon`; add to that list whenever you add a new
  top-level page (otherwise the new page would be eaten by the
  catch-all and rendered as a driver lookup).
- `driver.html` is also directly accessible at `/driver` for debug.

## Auth model

- Bearer token in `localStorage` (NOT cookies — sidesteps Safari third-party
  cookie restrictions). Server accepts both `Authorization: Bearer …` and
  the SDK session cookie at `authenticateRider` time.
- Signup hits `POST /api/rider/signup` (same endpoint the Rider app uses).
- Login hits `POST /api/rider/login`.
- `/me` is checked on every page load via `JoyrideAPI.loadCurrentUser()`.
- Logout is bound to the yellow header CTA when logged in (site.js).
- The `/account` page's bounce-to-login is intentionally gated on a
  definitive 401 only — transient 5xx errors keep the cached paint so
  /account ↔ /login doesn't ping-pong during a brief Railway redeploy.

## Verification flow

After signup the user is redirected to `/account?verify=1`. That URL flag
triggers a centered modal with email + mobile rows (each row independent;
Verified pill or `Enter Code · Resend` per channel; same DOM nodes as the
inline widget on /account, just CSS-repositioned). Modal auto-closes when
both verified. The X button + Escape key dismiss + strip `?verify=1` so a
reload doesn't re-open. Backdrop click is intentionally inert ("stays
open until both codes entered" unless explicitly dismissed).

## Related repos

- `joiryde-server-deploy` — Railway-hosted API + admin dashboard
  - `server/public-routes.ts` → `GET /api/public/driver/:username`
  - `server/rider-rides.ts` → `GET /api/rider/rides` + `GET /api/rider/rides/:id`
- `joiryde-rider`, `joiryde-driver` — Expo apps
