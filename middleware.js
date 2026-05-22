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

export default function middleware(request) {
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
