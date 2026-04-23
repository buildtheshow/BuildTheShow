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
    // Only reserve space for sidebars that actually occupy the left edge.
    // Mobile/off-canvas sidebars should not offset the footer.
    const selectors = [
      '.prod-sidebar',
      'aside.sidebar',
      '.sidebar',
      '.member-sidebar',
      '.dashboard-sidebar'
    ];
    const sidebar = selectors
      .map(selector => document.querySelector(selector))
      .find(el => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const occupiesLeftEdge = rect.width > 0 && rect.left <= 1;
        const isFixedColumn = style.position === 'fixed' || style.position === 'sticky';
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0;
        const isDesktop = window.matchMedia('(min-width: 761px)').matches;
        return isDesktop && isVisible && isFixedColumn && occupiesLeftEdge;
      });
    if (!sidebar) return 0;
    return Math.round(sidebar.getBoundingClientRect().width || sidebar.offsetWidth || 0);
  }

  function applyFooterOffset(footer) {
    if (footer.dataset.footerInsideMain === 'true') {
      footer.style.marginLeft = '0';
      footer.style.width = '100%';
      footer.style.maxWidth = '100%';
      return;
    }
    const sidebarW = getSidebarWidth();
    footer.style.marginLeft = sidebarW ? `${sidebarW}px` : '0';
    footer.style.width = sidebarW ? `calc(100% - ${sidebarW}px)` : '100%';
    footer.style.maxWidth = sidebarW ? `calc(100% - ${sidebarW}px)` : '100%';
  }

  function getMainFooterHost() {
    const candidates = [
      '.prod-main',
      '.main-content',
      '.dashboard-main',
      '.member-main'
    ];
    return candidates
      .map(selector => document.querySelector(selector))
      .find(el => {
        if (!el || el.closest('.modal, [role="dialog"]')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }) || null;
  }

  function injectFooter() {
    // Remove any existing page-level legal footers to avoid duplication.
    // Only removes <footer> elements that are direct children of <body>
    // (leaves modal footers, card footers etc. untouched).
    document.querySelectorAll('body > footer').forEach(el => el.remove());

    const footer = document.createElement('footer');
    footer.id = 'legal-footer';
    footer.setAttribute('aria-label', 'Legal');

    Object.assign(footer.style, {
      position:       'static',
      width:          '100%',
      maxWidth:       '100%',
      marginLeft:     '0',
      marginTop:      'auto',
      alignSelf:      'stretch',
      clear:          'both',
      flexShrink:     '0',
      display:        'flex',
      flexWrap:       'wrap',
      alignItems:     'center',
      gap:            '0.35rem 1.25rem',
      padding:        '1.35rem 2rem 0.6rem',
      background:     '#ffffff',
      borderTop:      '1px solid rgba(87,46,136,0.1)',
      zIndex:         'auto',
      boxSizing:      'border-box',
    });

    const year = new Date().getFullYear();

    footer.innerHTML = `
      <a href="${privacyUrl}" target="_blank" rel="noopener" style="font-size:0.78rem;color:#a098b8;text-decoration:none;font-weight:500;">Privacy Policy</a>
      <a href="${termsUrl}"   target="_blank" rel="noopener" style="font-size:0.78rem;color:#a098b8;text-decoration:none;font-weight:500;">Terms of Service</a>
      <a href="mailto:privacy@buildtheshow.com" style="font-size:0.78rem;color:#a098b8;text-decoration:none;font-weight:500;">Contact</a>
      <span style="font-size:0.78rem;color:#c8c0d8;">© ${year} Build The Show</span>
    `;

    const host = getMainFooterHost();
    footer.dataset.footerInsideMain = host ? 'true' : 'false';
    (host || document.body).appendChild(footer);
    document.body.style.paddingBottom = '0';
    applyFooterOffset(footer);

    // Recalculate if the sidebar loads asynchronously or the viewport changes.
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      applyFooterOffset(footer);
      if (attempts >= 10) clearInterval(poll);
    }, 300);
    window.addEventListener('resize', () => applyFooterOffset(footer));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }
})();
