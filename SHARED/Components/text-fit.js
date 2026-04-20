/**
 * TEXT FIT — lightweight, targeted version
 * Only shrinks elements that explicitly opt in via [data-textfit]
 * or elements with white-space:nowrap that are actually overflowing.
 * Debounced so it never fires more than once per 200ms.
 */
(function () {
  const MIN_PX = 9;
  const STEP   = 0.92;

  const SKIP_TAGS = new Set([
    'SCRIPT','STYLE','HEAD','HTML','BODY','SVG','PATH','DEFS',
    'SYMBOL','USE','G','INPUT','TEXTAREA','SELECT','NOSCRIPT',
    'TEMPLATE','CANVAS','VIDEO','AUDIO','IFRAME',
  ]);

  function fitElement(el) {
    if (SKIP_TAGS.has(el.tagName)) return;
    if (!el.offsetWidth) return;

    const cs = getComputedStyle(el);
    if (cs.whiteSpace !== 'nowrap' && cs.whiteSpace !== 'pre') return;
    if (el.scrollWidth <= el.offsetWidth + 1) return; // already fits

    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize) || 16;
    let iters = 0;

    while (el.scrollWidth > el.offsetWidth + 1 && size > MIN_PX && iters < 30) {
      size = Math.max(size * STEP, MIN_PX);
      el.style.fontSize = size + 'px';
      iters++;
    }
  }

  // Only scan elements that are likely to need fitting
  const TARGETS = 'h1,h2,h3,h4,.nav-logo-box,.tab,.btn,[data-textfit]';

  let timer = null;
  function fitAll() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      document.querySelectorAll(TARGETS).forEach(el => {
        try { fitElement(el); } catch (_) {}
      });
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fitAll);
  } else {
    fitAll();
  }

  window.addEventListener('resize', fitAll, { passive: true });
})();
