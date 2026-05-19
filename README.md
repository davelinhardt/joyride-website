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

## Related repos

- `joiryde-server-deploy` — Railway-hosted API + admin dashboard
- `joiryde-rider`, `joiryde-driver` — Expo apps
