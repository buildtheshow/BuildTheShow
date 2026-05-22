/* flipbook-viewer.js - reusable BTS digital book viewer built on StPageFlip */
(function () {
  'use strict';

  var DEFAULT_PAGE_FLIP_SCRIPT = 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js';
  var DEFAULT_PDF_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var DEFAULT_PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var DEFAULT_STYLESHEET = '/SHARED/Styles/flipbook-viewer.css?v=20260521-real-viewer';
  var loadedScripts = {};

  function esc(value) {
    return value == null ? '' : String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveElement(target) {
    if (typeof target === 'string') return document.querySelector(target);
    return target && target.nodeType === 1 ? target : null;
  }

  function loadScriptOnce(src) {
    if (!src) return Promise.resolve();
    if (src.indexOf('page-flip') !== -1 && window.St && window.St.PageFlip) return Promise.resolve();
    if (src.indexOf('pdf') !== -1 && getPdfGlobal()) return Promise.resolve();
    if (loadedScripts[src]) return loadedScripts[src];
    loadedScripts[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        if (existing.dataset.loaded === 'true') resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(script);
    });
    return loadedScripts[src];
  }

  function ensureStylesheet(href) {
    if (!href || document.querySelector('link[href="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function createShell(container, options) {
    container.innerHTML =
      '<section class="bts-flipbook-viewer" tabindex="0" aria-label="' + esc(options.title || 'Flipbook viewer') + '">' +
        '<div class="bts-flipbook-stage">' +
          '<button class="bts-flipbook-nav bts-flipbook-nav--prev" type="button" data-action="prev" aria-label="Previous page">&lsaquo;</button>' +
          '<div class="bts-flipbook-book-wrap">' +
            '<div class="bts-flipbook-book" data-book></div>' +
          '</div>' +
          '<button class="bts-flipbook-nav bts-flipbook-nav--next" type="button" data-action="next" aria-label="Next page">&rsaquo;</button>' +
        '</div>' +
        '<div class="bts-flipbook-status">' +
          '<span data-status>Loading book...</span>' +
          '<span data-page-count></span>' +
        '</div>' +
      '</section>';
    return {
      root: container.querySelector('.bts-flipbook-viewer'),
      book: container.querySelector('[data-book]'),
      wrap: container.querySelector('.bts-flipbook-book-wrap'),
      status: container.querySelector('[data-status]'),
      count: container.querySelector('[data-page-count]'),
    };
  }

  function getPdfGlobal() {
    return window.pdfjsLib || window.pdfjsDistBuildPdf;
  }

  function loadPdfPages(pdfUrl, options) {
    return loadScriptOnce(options.pdfScriptUrl || DEFAULT_PDF_SCRIPT).then(function () {
      var pdfjs = getPdfGlobal();
      if (!pdfjs) throw new Error('PDF renderer did not load.');
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = options.pdfWorkerUrl || DEFAULT_PDF_WORKER;
      }
      return pdfjs.getDocument(pdfUrl).promise.then(function (pdf) {
        var pages = [];
        var scale = Number(options.pdfScale) || 2;
        var chain = Promise.resolve();
        for (var i = 1; i <= pdf.numPages; i += 1) {
          (function (pageNumber) {
            chain = chain.then(function () {
              return pdf.getPage(pageNumber).then(function (page) {
                var viewport = page.getViewport({ scale: scale });
                var canvas = document.createElement('canvas');
                var context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                return page.render({ canvasContext: context, viewport: viewport }).promise.then(function () {
                  pages.push(canvas.toDataURL('image/jpeg', 0.92));
                });
              });
            });
          })(i);
        }
        return chain.then(function () { return pages; });
      });
    });
  }

  function resolvePages(options) {
    if (Array.isArray(options.pages) && options.pages.length) return Promise.resolve(options.pages.slice());
    if (options.pdfUrl) return loadPdfPages(options.pdfUrl, options);
    return Promise.reject(new Error('Flipbook viewer needs pages or pdfUrl.'));
  }

  function pageFlipSettings(options) {
    return Object.assign({
      width: Number(options.width) || 520,
      height: Number(options.height) || 735,
      size: 'stretch',
      minWidth: 260,
      maxWidth: 680,
      minHeight: 360,
      maxHeight: 920,
      drawShadow: true,
      flippingTime: 720,
      usePortrait: true,
      startPage: Number(options.startPage) || 0,
      autoSize: true,
      maxShadowOpacity: 0.28,
      showCover: true,
      mobileScrollSupport: true,
      swipeDistance: 24,
      clickEventForward: true,
      useMouseEvents: true,
      disableFlipByClick: false,
    }, options.pageFlip || {});
  }

  function updateCount(parts, pageFlip, pageCount) {
    var index = pageFlip && pageFlip.getCurrentPageIndex ? pageFlip.getCurrentPageIndex() : 0;
    parts.status.textContent = 'Page ' + Math.min(index + 1, pageCount) + ' of ' + pageCount;
    parts.count.textContent = pageCount > 1 ? 'Use arrows, swipe, or keyboard' : '';
  }

  function createFlipbookViewer(options) {
    var config = options || {};
    var container = resolveElement(config.container);
    if (!container) throw new Error('createFlipbookViewer requires a valid container.');

    ensureStylesheet(config.stylesheetUrl || DEFAULT_STYLESHEET);
    var parts = createShell(container, config);
    var destroyed = false;
    var pageFlip = null;

    function next() {
      if (pageFlip && pageFlip.flipNext) pageFlip.flipNext();
    }

    function prev() {
      if (pageFlip && pageFlip.flipPrev) pageFlip.flipPrev();
    }

    function handleClick(event) {
      var action = event.target && event.target.getAttribute('data-action');
      if (action === 'next') next();
      if (action === 'prev') prev();
    }

    function handleKey(event) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prev();
      }
    }

    parts.root.addEventListener('click', handleClick);
    parts.root.addEventListener('keydown', handleKey);

    var ready = loadScriptOnce(config.pageFlipScriptUrl || DEFAULT_PAGE_FLIP_SCRIPT)
      .then(function () {
        if (!window.St || !window.St.PageFlip) throw new Error('StPageFlip did not load.');
        return resolvePages(config);
      })
      .then(function (pages) {
        if (destroyed) return null;
        if (!pages.length) throw new Error('No pages found for this flipbook.');
        pageFlip = new window.St.PageFlip(parts.book, pageFlipSettings(config));
        pageFlip.on('init', function () { updateCount(parts, pageFlip, pages.length); });
        pageFlip.on('flip', function () { updateCount(parts, pageFlip, pages.length); });
        pageFlip.on('update', function () { updateCount(parts, pageFlip, pages.length); });
        pageFlip.loadFromImages(pages);
        parts.root.classList.add('is-ready');
        updateCount(parts, pageFlip, pages.length);
        return pageFlip;
      })
      .catch(function (error) {
        parts.root.classList.add('has-error');
        parts.status.textContent = error.message || 'Could not load flipbook.';
        throw error;
      });

    return {
      ready: ready,
      next: next,
      prev: prev,
      getPageFlip: function () { return pageFlip; },
      destroy: function () {
        destroyed = true;
        parts.root.removeEventListener('click', handleClick);
        parts.root.removeEventListener('keydown', handleKey);
        if (pageFlip && pageFlip.destroy) pageFlip.destroy();
        container.innerHTML = '';
      },
    };
  }

  window.createFlipbookViewer = createFlipbookViewer;
  window.BTSFlipbookViewer = { create: createFlipbookViewer };
})();
