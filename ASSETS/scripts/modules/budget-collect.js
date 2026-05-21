/* budget-collect.js — Collect page module */
(function () {
  'use strict';

  var _container = null;

  window.BudgetCollectModule = {

    init: function (prodId, container) {
      var s = window.BgtShared;
      s.BgtState.prodId = prodId;
      _container = container;

      container.innerHTML =
        '<div class="bgt-card">' +
          '<div class="bgt-card-title">Volunteer Receipt Submission</div>' +
          '<p style="font-size:0.88rem;color:#6b5f8a;margin:0 0 1.25rem;line-height:1.6">Share this link with your team. They fill in what they spent, their name, and their department. You review and approve from the Receipts page.</p>' +
          '<div class="bgt-toggle-row">' +
            '<button class="bgt-toggle" id="bgt-collect-toggle" onclick="BudgetCollectModule.toggleCollect()"></button>' +
            '<span class="bgt-toggle-label" id="bgt-collect-toggle-label">Accepting submissions</span>' +
          '</div>' +
          '<div id="bgt-collect-link-wrap">' +
            '<div class="bgt-collect-link">' +
              '<div class="bgt-collect-url" id="bgt-collect-url">Generating link...</div>' +
              '<button class="bgt-btn bgt-btn--ghost" onclick="BudgetCollectModule.copyCollectLink()">Copy Link</button>' +
            '</div>' +
            '<p style="font-size:0.78rem;color:#9a90b0;margin:0">Anyone with this link can submit a receipt. They do not need a Build The Show account.</p>' +
          '</div>' +
          '<div style="margin-top:1.5rem">' +
            '<div class="bgt-card-title">Expense categories on the form</div>' +
            '<p style="font-size:0.82rem;color:#6b5f8a;margin:0 0 0.75rem">These are your expense categories. Volunteers select the one that matches what they purchased.</p>' +
            '<div id="bgt-collect-categories" style="display:flex;flex-wrap:wrap;gap:0.4rem"></div>' +
          '</div>' +
        '</div>';

      this._load();
    },

    destroy: function () {
      _container = null;
    },

    _load: async function () {
      var s = window.BgtShared;
      if (!s.BgtState.categories.length) {
        try { s.BgtState.categories = await s.dbFetch('budget_categories'); } catch (_) {}
      }

      var settings = null;
      try {
        var data = await s.dbFetch('budget_settings', '&limit=1');
        settings = (data && data[0]) || null;
      } catch (_) {}

      if (!settings) {
        var token = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        try {
          var r = await fetch(s.SUPABASE_URL + '/rest/v1/budget_settings', {
            method: 'POST',
            headers: { apikey: s.SUPABASE_ANON, Authorization: 'Bearer ' + s.SUPABASE_ANON, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
            body: JSON.stringify({ production_id: s.BgtState.prodId, collect_enabled: true, collect_token: token }),
          });
          var created = await r.json();
          settings = (created && created[0]) || { collect_enabled: true, collect_token: token };
        } catch (_) { settings = { collect_enabled: true, collect_token: token }; }
      }

      s.BgtState.settings = settings;
      this._render();
    },

    _render: function () {
      var s        = window.BgtShared;
      var settings = s.BgtState.settings;
      var toggle   = document.getElementById('bgt-collect-toggle');
      var label    = document.getElementById('bgt-collect-toggle-label');
      if (toggle) toggle.classList.toggle('on', !!(settings && settings.collect_enabled));
      if (label)  label.textContent = (settings && settings.collect_enabled) ? 'Accepting submissions' : 'Submissions paused';

      var url   = window.location.origin + '/SYSTEM/Organisations/Productions/Workspace/budget-submit.html?token=' + ((settings && settings.collect_token) || '');
      var urlEl = document.getElementById('bgt-collect-url');
      if (urlEl) urlEl.textContent = url;

      var expCats = s.BgtState.categories.filter(function (c) { return c.type === 'expense'; });
      var catsEl  = document.getElementById('bgt-collect-categories');
      if (catsEl) {
        catsEl.innerHTML = expCats.length
          ? expCats.map(function (c) {
              return '<span style="display:inline-flex;padding:0.2rem 0.55rem;border-radius:999px;background:rgba(87,46,136,0.08);color:#572e88;font-size:0.76rem;font-weight:700">' + s.esc(c.name) + '</span>';
            }).join('')
          : '<span style="color:#9a90b0;font-size:0.84rem">No expense categories yet. Add them in the Breakdown page first.</span>';
      }
    },

    toggleCollect: async function () {
      var s      = window.BgtShared;
      var settings = s.BgtState.settings;
      var newVal = !(settings && settings.collect_enabled);
      try {
        await fetch(s.SUPABASE_URL + '/rest/v1/budget_settings?production_id=eq.' + s.BgtState.prodId, {
          method: 'PATCH',
          headers: { apikey: s.SUPABASE_ANON, Authorization: 'Bearer ' + s.SUPABASE_ANON, 'Content-Type': 'application/json' },
          body: JSON.stringify({ collect_enabled: newVal }),
        });
        if (s.BgtState.settings) s.BgtState.settings.collect_enabled = newVal;
        this._render();
      } catch (e) { alert('Could not update: ' + e.message); }
    },

    copyCollectLink: function () {
      var url = (document.getElementById('bgt-collect-url') || {}).textContent || '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { alert('Link copied!'); }).catch(function () { prompt('Copy this link:', url); });
      } else {
        prompt('Copy this link:', url);
      }
    },
  };
})();
