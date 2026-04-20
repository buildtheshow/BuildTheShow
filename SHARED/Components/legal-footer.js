/**
 * ═══════════════════════════════════════════════════════════════
 * LEGAL FOOTER — Shared component
 * Injects a page-flow legal footer at the bottom of the page.
 * Handles sidebar offset automatically on desktop.
 *
 * Usage: include this script anywhere on the page.
 * <script src="path/to/SHARED/Components/legal-footer.js"></script>
 *
 * The footer stays in normal document flow so it never overlaps page content.
 * Pages using body { min-height: 100vh; display:flex; flex-direction:column; }
 * will keep it at the bottom when content is short.
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  // Resolve paths relative to this script's location
  function resolveUrl(relativePath) {
    try {
      const scripts = Array.from(document.scripts || []);
      const me = scripts.find(s =>
        String(s.src || '').includes('legal-footer.js')
      );
      if (me && me.src) {
        return new URL(relativePath, me.src).href;
      }
    } catch (_) {}
    return relativePath;
  }

  const privacyUrl = resolveUrl('../Legal/privacy-policy.html');
  const termsUrl   = resolveUrl('../Legal/terms-of-service.html');

  function getSidebarWidth() {
    // Check for known sidebar selectors used across the app
    const sidebar =
      document.querySelector('.prod-sidebar') ||
      document.querySelector('aside.sidebar') ||
      document.querySelector('.member-sidebar') ||
      document.querySelector('.dashboard-sidebar');
    if (!sidebar) return 0;
    return sidebar.offsetWidth || 220;
  }

  function injectFooter() {
    // Remove any existing page-level legal footers to avoid duplication.
    // Only removes <footer> elements that are direct children of <body>
    // (leaves modal footers, card footers etc. untouched).
    document.querySelectorAll('body > footer').forEach(el => el.remove());

    const sidebarW = getSidebarWidth();

    const footer = document.createElement('footer');
    footer.id = 'legal-footer';
    footer.setAttribute('aria-label', 'Legal');

    Object.assign(footer.style, {
      position:       'relative',
      width:          '100%',
      marginLeft:     '0',
      marginTop:      'auto',
      flexShrink:     '0',
      zIndex:         '9000',
      display:        'flex',
      flexWrap:       'wrap',
      alignItems:     'center',
      gap:            '0.35rem 1.25rem',
      padding:        '0.6rem 2rem',
      background:     '#ffffff',
      borderTop:      '1px solid rgba(87,46,136,0.1)',
    });

    const year = new Date().getFullYear();

    footer.innerHTML = `
      <a href="${privacyUrl}" target="_blank" rel="noopener" style="font-size:0.78rem;color:#a098b8;text-decoration:none;font-weight:500;">Privacy Policy</a>
      <a href="${termsUrl}"   target="_blank" rel="noopener" style="font-size:0.78rem;color:#a098b8;text-decoration:none;font-weight:500;">Terms of Service</a>
      <a href="mailto:privacy@buildtheshow.com" style="font-size:0.78rem;color:#a098b8;text-decoration:none;font-weight:500;">Contact</a>
      <span style="font-size:0.78rem;color:#c8c0d8;">© ${year} Build The Show</span>
    `;

    document.body.appendChild(footer);
    document.body.style.paddingBottom = '0';

    // Recalculate left offset if the sidebar loads asynchronously
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      const w = getSidebarWidth();
      if (w !== sidebarW) {
        footer.style.marginLeft = '0';
        footer.style.width = '100%';
      }
      if (attempts >= 10) clearInterval(poll);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
