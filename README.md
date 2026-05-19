# joyride-website

Marketing + auth website for Joyride, deployed at https://joyride.cool/.

Static HTML/CSS/JS hosted on Vercel, talking to the joiryde-api Railway backend
for login / signup / driver profiles / rider tool.

## Structure

- `index.html` — landing
- `riders.html` — marketing for riders
- `drivers.html` — marketing for drivers
- `login.html` — auth (login + signup tabs, mirrors the rider app signup flow)
- `blog.html`, `contact.html`, `design-system.html`
- `styles.css`, `site.js`, `assets/`
- `vercel.json` — clean URLs, security headers, immutable asset cache

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

## Related repos

- `joiryde-server-deploy` — Railway-hosted API + admin dashboard
- `joiryde-rider`, `joiryde-driver` — Expo apps
