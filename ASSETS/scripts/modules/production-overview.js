/* production-overview.js — Main production overview / landing page */
(function () {
  'use strict';

  var _container = null;

  window.ProductionOverviewModule = {

    init: function (prodId, container) {
      var s = window.BgtShared;
      s.BgtState.prodId = prodId;
      _container = container;

      container.innerHTML =
        '<div class="aud-visual-hero">' +
          '<div class="aud-visual-hero-content">' +
            '<div>' +
              '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span><span class="page-hierarchy"><span class="page-hierarchy-page">Overview</span></span></div>' +
              '<h1 class="aud-visual-title">Overview</h1>' +
              '<p class="aud-visual-copy">The heartbeat of your show. See your budget health, upcoming tasks, and production status at a glance.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bgt-tile-grid" id="ovw-stats-grid">' +
          '<div style="color:#9a90b0;padding:2rem;text-align:center">Loading budget health...</div>' +
        '</div>';

      this._load();
    },

    destroy: function () {
      _container = null;
    },

    _load: async function () {
      var s = window.BgtShared;
      var cats = [];
      try {
        // We fetch the budget categories to calculate the current health
        cats = await s.dbFetch('budget_categories');
      } catch (_) { cats = []; }

      var income   = cats.filter(function (c) { return c.type === 'income'; }).reduce(function (a, c) { return a + (c.planned_cents || 0); }, 0);
      var expenses = cats.filter(function (c) { return c.type === 'expense'; }).reduce(function (a, c) { return a + (c.planned_cents || 0); }, 0);
      var net      = income - expenses;

      this._render(net);
    },

    _render: function (net) {
      var s = window.BgtShared;
      var grid = document.getElementById('ovw-stats-grid');
      if (!grid) return;

      var healthColor = net >= 0 ? '#769e7b' : '#d1523d';
      var healthStatus = net >= 0 ? 'Surplus' : 'Deficit';

      // Using the Brand Tile System for the health tile
      grid.innerHTML =
        '<div class="template-brand-card template-brand-card--square template-brand-card--metric" style="--brand-tile-bg:' + healthColor + ';--brand-tile-ink:#ffffff;">' +
          '<div class="template-brand-card-inner"><div class="template-brand-tile-content">' +
            '<div class="template-brand-tile-container template-brand-tile-container--header">' +
              '<div class="template-brand-tile-kicker">Budget Health</div>' +
            '</div>' +
            '<div class="template-brand-tile-container template-brand-tile-container--title">' +
              '<div class="template-brand-tile-number" style="font-size:18cqw">' + s.fmt$(net) + '</div>' +
            '</div>' +
            '<div class="template-brand-tile-container template-brand-tile-container--body">' +
              '<div class="template-brand-tile-metric-label">' + healthStatus + '</div>' +
            '</div>' +
            '<div class="template-brand-tile-container template-brand-tile-container--footer">' +
              '<div class="template-brand-tile-settings-helper" style="color:#ffffff">' + (net >= 0 ? 'You are currently in a surplus' : 'You are currently in a deficit') + '</div>' +
            '</div>' +
          '</div></div>' +
        '</div>';
    }
  };
})();