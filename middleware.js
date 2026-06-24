// Vercel Edge Middleware — HTTP Basic Auth gate for the entire site.
//
// Locks joyride.cool behind a shared password while we are still
// iterating on the content. To lift the gate later: delete this file
// and `vercel --prod` to redeploy. The corresponding env var
// (SITE_PASSWORD) can be removed via `vercel env rm SITE_PASSWORD
// production` once the gate is gone.
//
// Username is ignored — any string works as long as the password
// matches. The realm message in the browser prompt tells visitors
// they only need the password.

export const config = {
  // Apply to every route. No carve-outs — even /assets/* needs auth,
  // because the design system + logo are part of "stuff we don't
  // want random visitors seeing yet."
  matcher: '/(.*)',
};

// Paths that are publicly accessible — bypassed by the password gate.
// Add entries here whenever a specific page needs to be shared with
// people who don't have the site password (investor landing pages,
// press one-pagers, etc.).
//
// The shared design-system files (styles.css / site.js / api.js) and
// /assets/ are ALSO public, because every public page needs to load
// them. If we didn't allow those, the page HTML would 401 its
// subresources and the browser would cascade the basic-auth prompt
// over the parent page (the 2026-05-24 /raise1 password-prompt bug).
// Branding + screenshots in /assets/ aren't sensitive on their own —
// the gate exists for unreleased HTML pages.
const PUBLIC_PATHS = [
  '/raise1',                  // investor landing (added 2026-05-24)
  '/raise1.html',
  '/raise1/uber_analysis',    // investor article (added 2026-06-03)
  '/raise1-uber-analysis.html',
  '/raise1/tam',              // TAM/SAM/SOM visualization (added 2026-06-21)
  '/raise1-tam.html',
  '/raise1/invest',           // equity crowdfunding invest page (added 2026-06-24)
  '/raise1-invest.html',
  '/styles.css',              // design system stylesheet
  '/site.js',                 // header/footer injector
  // Root-level files that browsers (Safari, Chrome) auto-fetch on
  // every page load. If any of these returns a 401 with
  // WWW-Authenticate, the browser pops the basic-auth prompt up
  // over whatever page the user is actually trying to view —
  // even when the page HTML itself is gate-exempt. Letting them
  // 404 instead of 401 is what we want here; the gate only exists
  // to hide unreleased HTML pages.
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/apple-app-site-association',
];
const PUBLIC_PREFIXES = [
  '/assets/',                 // logos, brand marks, page screenshots
  '/js/',                     // /js/api.js etc.
  '/.well-known/',            // change-password, security.txt, ACME challenges, etc.
];

export default function middleware(request) {
  const url = new URL(request.url);
  if (
    PUBLIC_PATHS.includes(url.pathname) ||
    PUBLIC_PREFIXES.some((p) => url.pathname.startsWith(p))
  ) {
    return;
  }

  const auth = request.headers.get('authorization');
  const expected = process.env.SITE_PASSWORD || '';

  if (auth && auth.startsWith('Basic ')) {
    const encoded = auth.slice(6);
    let decoded;
    try {
      decoded = atob(encoded);
    } catch (_) {
      decoded = '';
    }
    const idx = decoded.indexOf(':');
    if (idx >= 0) {
      const pass = decoded.slice(idx + 1);
      if (expected && pass === expected) {
        // Authorized — let the request continue to the static file
        // / rewrite handler downstream.
        return;
      }
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Joyride preview (any username; password required)"',
      'Content-Type': 'text/plain',
    },
  });
}
