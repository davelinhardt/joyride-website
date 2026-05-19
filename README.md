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
