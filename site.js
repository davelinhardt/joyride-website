// Joyride site — shared header/footer (dark mode only).

window.addEventListener('error', (e) => {
  if (e.message && e.message.indexOf('ResizeObserver') !== -1) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

(function() {
  function el(tag, attrs = {}, html = '') {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, v));
    if (html) e.innerHTML = html;
    return e;
  }

  function buildHeader(active) {
    // All nav hrefs use absolute, no-.html paths so they resolve the
    // same way under the catch-all rewrite (joyride.cool/{username})
    // as they do under the known-page rewrites — and so the URL bar
    // matches Vercel's source patterns in vercel.json.
    const navItems = [
      { href: '/', label: 'Home', key: 'home' },
      { href: '/drivers', label: 'Drivers', key: 'drivers' },
      { href: '/riders', label: 'Riders', key: 'riders' },
      { href: '/blog', label: 'Updates', key: 'blog' },
      { href: '/contact', label: 'Contact', key: 'contact' },
    ];
    const navHtml = navItems.map(it =>
      `<a href="${it.href}" class="${it.key === active ? 'is-active' : ''}">${it.label}</a>`
    ).join('') + `
      <div class="mobile-cta-stack">
        <a href="/login" class="btn btn--ghost btn--sm">Log in</a>
        <a href="/riders" class="btn btn--primary btn--sm">Get the app <span class="arrow">→</span></a>
      </div>
    `;

    const header = el('header', { class: 'site-header' }, `
      <div class="wrap">
        <a href="/" class="brand" aria-label="Joyride home">
          <img src="/assets/lockup-on-dark.svg" alt="Joyride">
        </a>
        <nav>${navHtml}</nav>
        <div class="nav-cta">
          <a href="/login" class="btn btn--ghost btn--sm">Log in</a>
          <a href="/riders" class="btn btn--primary btn--sm">Get the app <span class="arrow">→</span></a>
          <button class="menu-toggle" aria-label="Open menu" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
        </div>
      </div>
    `);
    document.body.prepend(header);
    header.querySelector('.menu-toggle').addEventListener('click', () =>
      header.classList.toggle('is-open')
    );
  }

  function buildFooter() {
    const footer = el('footer', { class: 'site-footer' }, `
      <div class="wrap">
        <div class="top">
          <div>
            <a href="/" class="brand">
              <img src="/assets/lockup-on-dark.svg" alt="Joyride">
            </a>
            <p class="blurb"><strong style="color:var(--canary);">Enjoy the ride.</strong> A new kind of rideshare. Drivers keep 100% of the fare. Riders get a fairer ride.</p>
            <form class="newsletter" onsubmit="event.preventDefault(); this.querySelector('button').textContent='Thanks ✓'; this.querySelector('input').value='';">
              <input type="email" required placeholder="Your email" aria-label="Email for newsletter">
              <button type="submit">Subscribe</button>
            </form>
          </div>
          <div>
            <h4>Joyride</h4>
            <ul>
              <li><a href="/drivers">For drivers</a></li>
              <li><a href="/riders">For riders</a></li>
              <li><a href="/blog">Latest updates</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Press</a></li>
              <li><a href="#">Investors</a></li>
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul>
              <li><a href="#">Driver support</a></li>
              <li><a href="#">Rider support</a></li>
              <li><a href="#">Safety</a></li>
              <li><a href="#">Cities</a></li>
            </ul>
          </div>
        </div>
        <div class="bottom">
          <span>© 2026 Joyride, Inc. All rights reserved.</span>
          <span>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Cookies</a>
          </span>
        </div>
      </div>
    `);
    document.body.appendChild(footer);
  }

  /**
   * Swap the header's "Log in / Get the app" CTAs for an
   * "Account / Log out" pair whenever we have a session token.
   *
   * Runs in two passes:
   *   1. Synchronous, using JoyrideAPI.readCachedUser() — fires
   *      immediately so returning users don't see a flash of the
   *      logged-out CTAs.
   *   2. Async, calling /api/rider/me to refresh + clear stale
   *      tokens if the server doesn't recognize us anymore (e.g.
   *      session expired, account deactivated).
   *
   * Each pass calls the same renderer so we avoid divergent code
   * paths. No-op if JoyrideAPI isn't loaded (e.g. on a page that
   * skipped api.js for some reason).
   */
  function renderAuthCta(user) {
    var ctaWrap = document.querySelector('.site-header .nav-cta');
    var mobileStack = document.querySelector('.site-header .mobile-cta-stack');
    if (!ctaWrap) return;
    var loggedIn = !!user;
    // On the /account page itself, the canonical primary CTA flips
    // from "My account" (redundant — they're already there) to
    // "Log out" (per Dave 2026-05-20: one consolidated logout
    // affordance instead of a separate footer button on /account).
    var onAccountPage = document.body && document.body.dataset && document.body.dataset.page === 'account';
    var primaryIsLogout = loggedIn && onAccountPage;

    var label = loggedIn ? (user.firstName || 'Account') : 'Log in';
    var ghostHref = loggedIn ? '/account' : '/login';
    var primaryHref, primaryLabel, primaryArrow;
    if (primaryIsLogout) {
      primaryLabel = 'Log out';
      primaryArrow = ''; // no → arrow on the logout CTA — it's not a forward action
      primaryHref = '#';
    } else if (loggedIn) {
      primaryLabel = 'My account';
      primaryArrow = '<span class="arrow">→</span>';
      primaryHref = '/account';
    } else {
      primaryLabel = 'Get the app';
      primaryArrow = '<span class="arrow">→</span>';
      primaryHref = '/login';
    }

    // Replace just the two .btn anchors in the desktop nav-cta. Keep
    // the .menu-toggle button as-is. Apply the same swap to the
    // mobile stack so the header reads the same in both layouts.
    var desktopBtns = ctaWrap.querySelectorAll('a.btn');
    var mobBtns = mobileStack ? mobileStack.querySelectorAll('a.btn') : [];
    var primaries = [];
    if (desktopBtns.length >= 2) {
      desktopBtns[0].textContent = label;
      desktopBtns[0].setAttribute('href', ghostHref);
      desktopBtns[1].innerHTML = primaryLabel + (primaryArrow ? ' ' + primaryArrow : '');
      desktopBtns[1].setAttribute('href', primaryHref);
      primaries.push(desktopBtns[1]);
    }
    if (mobBtns.length >= 2) {
      mobBtns[0].textContent = label;
      mobBtns[0].setAttribute('href', ghostHref);
      mobBtns[1].innerHTML = primaryLabel + (primaryArrow ? ' ' + primaryArrow : '');
      mobBtns[1].setAttribute('href', primaryHref);
      primaries.push(mobBtns[1]);
    }

    // Bind the logout handler when we're in logout-mode. Using
    // `.onclick = …` (not addEventListener) so the two-pass refresh
    // (cached → fresh) cleanly replaces the previous handler
    // instead of stacking listeners on each repaint. Clear the
    // handler in non-logout mode so the button reverts to plain
    // navigation.
    primaries.forEach(function (btn) {
      if (primaryIsLogout) {
        btn.onclick = async function (e) {
          e.preventDefault();
          try {
            // Best-effort server-side session clear (matches the
            // older footer logout button's behavior).
            await window.JoyrideAPI.apiPost('/api/rider/logout', {});
          } catch (_) { /* ignore — local clear is what actually matters */ }
          window.JoyrideAPI.clearAuth();
          window.location.assign('/login');
        };
      } else {
        btn.onclick = null;
      }
    });
  }

  async function refreshAuthCta() {
    if (typeof window === 'undefined' || !window.JoyrideAPI) return;
    // Cached pass — instant, avoids flicker.
    renderAuthCta(window.JoyrideAPI.readCachedUser());
    // Authoritative pass — only fires if we actually have a token
    // so we don't spam /api/rider/me on every marketing page view.
    if (window.JoyrideAPI.getToken()) {
      var fresh = await window.JoyrideAPI.loadCurrentUser();
      renderAuthCta(fresh);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page || 'home';
    buildHeader(page);
    buildFooter();
    refreshAuthCta();
  });
})();
