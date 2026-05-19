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
    const navItems = [
      { href: 'index.html', label: 'Home', key: 'home' },
      { href: 'drivers.html', label: 'Drivers', key: 'drivers' },
      { href: 'riders.html', label: 'Riders', key: 'riders' },
      { href: 'blog.html', label: 'Updates', key: 'blog' },
      { href: 'contact.html', label: 'Contact', key: 'contact' },
    ];
    const navHtml = navItems.map(it =>
      `<a href="${it.href}" class="${it.key === active ? 'is-active' : ''}">${it.label}</a>`
    ).join('') + `
      <div class="mobile-cta-stack">
        <a href="login.html" class="btn btn--ghost btn--sm">Log in</a>
        <a href="riders.html" class="btn btn--primary btn--sm">Get the app <span class="arrow">→</span></a>
      </div>
    `;

    const header = el('header', { class: 'site-header' }, `
      <div class="wrap">
        <a href="index.html" class="brand" aria-label="Joyride home">
          <img src="assets/lockup-on-dark.svg" alt="Joyride">
        </a>
        <nav>${navHtml}</nav>
        <div class="nav-cta">
          <a href="login.html" class="btn btn--ghost btn--sm">Log in</a>
          <a href="riders.html" class="btn btn--primary btn--sm">Get the app <span class="arrow">→</span></a>
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
            <a href="index.html" class="brand">
              <img src="assets/lockup-on-dark.svg" alt="Joyride">
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
              <li><a href="drivers.html">For drivers</a></li>
              <li><a href="riders.html">For riders</a></li>
              <li><a href="blog.html">Latest updates</a></li>
              <li><a href="contact.html">Contact</a></li>
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

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page || 'home';
    buildHeader(page);
    buildFooter();
  });
})();
