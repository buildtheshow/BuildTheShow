/**
 * ═══════════════════════════════════════════════════════════════
 * TEXT FIT — Shared component
 * Automatically shrinks text that overflows its container.
 * Never cuts text mid-word. Minimum font size: 9px.
 *
 * Usage: include this script anywhere on the page.
 * <script src="/SHARED/Components/text-fit.js"></script>
 *
 * Elements with white-space:nowrap that overflow will have their
 * font-size reduced until they fit. A ResizeObserver re-runs this
 * whenever the layout changes (resize, tab switch, dynamic content).
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  const MIN_PX   = 9;
  const STEP     = 0.92;   // multiply font-size by this each iteration

  // Tags we never touch — structural or invisible elements
  const SKIP_TAGS = new Set([
    'SCRIPT','STYLE','HEAD','HTML','BODY','SVG','PATH','DEFS',
    'SYMBOL','USE','G','RECT','CIRCLE','LINE','POLYLINE','POLYGON',
    'INPUT','TEXTAREA','SELECT','OPTION','OPTGROUP','NOSCRIPT',
    'TEMPLATE','CANVAS','VIDEO','AUDIO','IFRAME','OBJECT','EMBED',
  ]);

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function fitElement(el) {
    if (SKIP_TAGS.has(el.tagName)) return;
    // Only act on elements that declare nowrap (single-line elements)
    const cs = getComputedStyle(el);
    if (cs.whiteSpace !== 'nowrap' && cs.whiteSpace !== 'pre') return;
    if (!isVisible(el)) return;

    // Reset any previously applied size so we measure from the natural size
    el.style.fontSize = '';

    let size = parseFloat(cs.fontSize) || 16;
    let iterations = 0;
    const maxIter = 40;

    while (el.scrollWidth > el.offsetWidth + 1 && size > MIN_PX && iterations < maxIter) {
      size = Math.max(size * STEP, MIN_PX);
      el.style.fontSize = size + 'px';
      iterations++;
    }
  }

  function fitAll() {
    // Walk every element in the document
    document.querySelectorAll('*').forEach(el => {
      try { fitElement(el); } catch (_) {}
    });
  }

  // Run after layout is ready
  function scheduleRun() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(fitAll));
    } else {
      requestAnimationFrame(fitAll);
    }
  }

  scheduleRun();

  // Re-run on any layout change (resize, orientation, dynamic content)
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => requestAnimationFrame(fitAll));
    ro.observe(document.body);
  } else {
    window.addEventListener('resize', () => requestAnimationFrame(fitAll));
  }

  // Re-run when new nodes are added (modals, dynamic cards, etc.)
  const mo = new MutationObserver(mutations => {
    const relevant = mutations.some(m => m.addedNodes.length > 0);
    if (relevant) requestAnimationFrame(fitAll);
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
