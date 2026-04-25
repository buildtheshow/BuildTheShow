/**
 * Build The Show — Page Loader
 * Creates a full-screen loading overlay immediately on script run (no blank flash).
 * Pages set window.BTS_LOAD_MSGS before including this script to customise messages.
 * Call PageLoader.hide() once the page content is ready.
 */
(function () {
  'use strict';

  const CYCLE_MS   = 1900;
  const FADE_MS    = 420;

  const DEFAULT_MSGS = [
    'Setting the stage...',
    'Calling places...',
    'Warming up the lights...',
    'Checking the call sheet...',
    'Getting everyone ready...',
    'Opening the curtain...',
  ];

  const msgs   = (window.BTS_LOAD_MSGS && window.BTS_LOAD_MSGS.length) ? window.BTS_LOAD_MSGS : DEFAULT_MSGS;
  let msgIndex = Math.floor(Math.random() * msgs.length);
  let cycleTimer  = null;
  let hidden      = false;

  // ── Build overlay ────────────────────────────────────────────────────────
  const el = document.createElement('div');
  el.id = 'bts-page-loader';
  el.innerHTML = `
    <div class="bts-pl-inner">
      <div class="bts-pl-logo">BUILD THE SHOW</div>
      <div class="bts-pl-msg" id="bts-pl-msg">${msgs[msgIndex]}</div>
      <div class="bts-pl-dots"><span></span><span></span><span></span></div>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    #bts-page-loader {
      position: fixed; inset: 0; z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      background: #1a1530;
      opacity: 1;
      transition: opacity ${FADE_MS}ms ease;
      pointer-events: all;
    }
    #bts-page-loader.bts-pl-hiding { opacity: 0; pointer-events: none; }

    .bts-pl-inner {
      display: flex; flex-direction: column; align-items: center; gap: 1.1rem;
      user-select: none;
    }

    .bts-pl-logo {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 0.7rem; font-weight: 800; letter-spacing: 0.22em;
      text-transform: uppercase; color: rgba(255,255,255,0.35);
    }

    .bts-pl-msg {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 1.05rem; font-weight: 500; color: rgba(255,255,255,0.72);
      min-height: 1.5em; text-align: center;
      transition: opacity 0.3s ease;
    }
    .bts-pl-msg.bts-pl-msg-fade { opacity: 0; }

    .bts-pl-dots {
      display: flex; gap: 0.5rem; margin-top: 0.25rem;
    }
    .bts-pl-dots span {
      width: 6px; height: 6px; border-radius: 50%;
      background: rgba(87,46,136,0.7);
      animation: bts-pl-bounce 1.2s ease-in-out infinite;
    }
    .bts-pl-dots span:nth-child(2) { animation-delay: 0.2s; }
    .bts-pl-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bts-pl-bounce {
      0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
      40%            { transform: scale(1.2); opacity: 1;   }
    }
  `;

  // ── Inject into DOM as early as possible ─────────────────────────────────
  function inject() {
    if (document.head) document.head.appendChild(style);
    else document.documentElement.appendChild(style);
    if (document.body) {
      document.body.insertBefore(el, document.body.firstChild);
    } else {
      // Body not ready — wait for it
      document.addEventListener('DOMContentLoaded', function onDCL() {
        document.removeEventListener('DOMContentLoaded', onDCL);
        document.body.insertBefore(el, document.body.firstChild);
        startCycle();
      });
      return;
    }
    startCycle();
  }

  // ── Message cycling ───────────────────────────────────────────────────────
  function startCycle() {
    cycleTimer = setInterval(function () {
      if (hidden) return;
      const msgEl = document.getElementById('bts-pl-msg');
      if (!msgEl) return;
      msgEl.classList.add('bts-pl-msg-fade');
      setTimeout(function () {
        if (hidden) return;
        msgIndex = (msgIndex + 1) % msgs.length;
        msgEl.textContent = msgs[msgIndex];
        msgEl.classList.remove('bts-pl-msg-fade');
      }, 300);
    }, CYCLE_MS);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.PageLoader = {
    hide: function () {
      if (hidden) return;
      hidden = true;
      clearInterval(cycleTimer);
      el.classList.add('bts-pl-hiding');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, FADE_MS + 50);
    },
  };

  inject();
})();
