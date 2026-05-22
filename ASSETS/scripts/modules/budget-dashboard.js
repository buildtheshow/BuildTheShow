/* budget-dashboard.js — Dashboard module */
(function () {
  'use strict';

  function metricTile(id, kicker, value, label, color) {
    var bg  = color || '#476aaa';
    return '<div class="template-brand-card template-brand-card--square template-brand-card--metric" style="--brand-tile-bg:' + bg + ';--brand-tile-ink:#ffffff;" id="' + id + '-card">' +
      '<div class="template-brand-card-inner"><div class="template-brand-tile-content">' +
        '<div class="template-brand-tile-container template-brand-tile-container--header">' +
          '<div class="template-brand-tile-kicker">' + kicker + '</div>' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--title">' +
          '<div class="template-brand-tile-number" id="' + id + '">' + value + '</div>' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--body">' +
          '<div class="template-brand-tile-metric-label">' + label + '</div>' +
        '</div>' +
        '<div class="template-brand-tile-container template-brand-tile-container--footer">' +
          '<div class="template-brand-tile-settings-helper" id="' + id + '-helper"></div>' +
        '</div>' +
      '</div></div>' +
    '</div>';
  }

  window.BudgetDashboardModule = {

    init: function (prodId, container) {
      var s = window.BgtShared;
      s.BgtState.prodId = prodId;

      container.innerHTML =
        '<div class="aud-visual-hero">' +
          '<div class="aud-visual-hero-content">' +
            '<div>' +
              '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span>Budgeting</div>' +
              '<h1 class="aud-visual-title">At a glance.</h1>' +
              '<p class="aud-visual-copy">Track income, expenses, and receipts for this production.</p>' +
            '</div>' +
            '<div class="aud-visual-total">' +
              '<div class="aud-visual-total-kicker">Receipts</div>' +
              '<div class="aud-visual-total-value" id="bgt-hero-count">0</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bgt-tile-grid" id="bgt-stats">' +
          metricTile('bgt-stat-income',    'Budgeting', '...', 'Planned Income<br><span style="font-size:0.75em;opacity:0.8;">(money coming in)</span>',    '#769e7b') +
          metricTile('bgt-stat-expenses',  'Budgeting', '...', 'Planned Expenses<br><span style="font-size:0.75em;opacity:0.8;">(money going out)</span>',  '#476aaa') +
          metricTile('bgt-stat-net',       'Budgeting', '...', 'Net Position<br><span style="font-size:0.75em;opacity:0.8;">(bottom line)</span>',      '#572e88') +
          metricTile('bgt-stat-spent',     'Budgeting', '...', 'Actual Spent<br><span style="font-size:0.75em;opacity:0.8;">(real money spent)</span>',      '#dd8233') +
          metricTile('bgt-stat-remaining', 'Budgeting', '...', 'Budget Remaining<br><span style="font-size:0.75em;opacity:0.8;">(what\'s left to spend)</span>',  '#572e88') +
          metricTile('bgt-stat-pending',   'Budgeting', '...', 'Pending Receipts<br><span style="font-size:0.75em;opacity:0.8;">(waiting for review)</span>',  '#efab45') +
          metricTile('bgt-stat-total',     'Budgeting', '...', 'Total Receipts<br><span style="font-size:0.75em;opacity:0.8;">(every submission)</span>',    '#476aaa') +
          metricTile('bgt-stat-cats',      'Budgeting', '...', 'Expense Categories<br><span style="font-size:0.75em;opacity:0.8;">(budget buckets)</span>','#ca7ea7') +
        '</div>' +
        '<div class="bgt-card">' +
          '<div class="bgt-card-title">Needs attention</div>' +
          '<div id="bgt-alerts" class="bgt-alert-list"><div style="color:#9a90b0;font-size:0.85rem">Loading...</div></div>' +
        '</div>';

      this._load();
    },

    destroy: function () {},

    _load: async function () {
      var s = window.BgtShared;
      var cats = [], rcts = [];
      try {
        var results = await Promise.all([s.dbFetch('budget_categories'), s.dbFetch('budget_receipts')]);
        cats = results[0] || [];
        rcts = results[1] || [];
      } catch (_) {}

      s.BgtState.categories = cats;
      s.BgtState.receipts   = rcts;

      var income    = cats.filter(function (c) { return c.type === 'income'; }).reduce(function (a, c) { return a + (c.planned_cents || 0); }, 0);
      var expenses  = cats.filter(function (c) { return c.type === 'expense'; }).reduce(function (a, c) { return a + (c.planned_cents || 0); }, 0);
      var net       = income - expenses;
      var approved  = rcts.filter(function (r) { return r.status === 'approved'; }).reduce(function (a, r) { return a + (r.amount_cents || 0); }, 0);
      var pending   = rcts.filter(function (r) { return r.status === 'pending'; }).length;
      var remaining = expenses - approved;
      var expCats   = cats.filter(function (c) { return c.type === 'expense'; }).length;

      function setTile(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
      }

      setTile('bgt-hero-count',    rcts.length);
      setTile('bgt-stat-income',   s.fmt$(income));
      setTile('bgt-stat-expenses', s.fmt$(expenses));

      var netEl = document.getElementById('bgt-stat-net');
      if (netEl) {
        netEl.textContent = s.fmt$(net);
        var card = netEl.closest('.template-brand-card');
        if (card) card.style.setProperty('--brand-tile-bg', net >= 0 ? '#769e7b' : '#d1523d');
      }

      setTile('bgt-stat-spent',    s.fmt$(approved));
      setTile('bgt-stat-remaining',s.fmt$(remaining));
      setTile('bgt-stat-pending',  pending);
      setTile('bgt-stat-total',    rcts.length);
      setTile('bgt-stat-cats',     expCats);

      // Smart Insights and Scaling
      if (typeof fitBrandTileTitles === 'function') {
        requestAnimationFrame(function() {
          fitBrandTileTitles(document.getElementById('bgt-stats'));
        });
      }

      // Spent Percentage Logic
      var spentEl = document.getElementById('bgt-stat-spent-helper');
      if (spentEl && expenses > 0) {
        var pct = Math.round((approved / expenses) * 100);
        spentEl.textContent = pct + '% of planned budget spent';
        var spentCard = document.getElementById('bgt-stat-spent-card');
        if (spentCard && pct > 100) spentCard.style.setProperty('--brand-tile-bg', '#d1523d');
      }

      // Smart Insights
      var remainingEl = document.getElementById('bgt-stat-remaining-helper');
      if (remainingEl) {
        if (remaining < 0) remainingEl.textContent = 'Budget exceeded';
        else if (remaining < (expenses * 0.1) && expenses > 0) remainingEl.textContent = 'Low funds remaining';
        else remainingEl.textContent = 'Funds available';
      }

      var pendingEl = document.getElementById('bgt-stat-pending-helper');
      if (pendingEl) pendingEl.textContent = pending > 0 ? pending + ' items to review' : 'All clear';

      var alerts = [];
      if (!cats.length)         alerts.push(['warn', 'No budget categories set up yet']);
      if (net < 0 && cats.length) alerts.push(['err', 'Budget is in deficit by ' + s.fmt$(Math.abs(net))]);
      if (remaining < 0)        alerts.push(['err', 'Overspent by ' + s.fmt$(Math.abs(remaining)) + ' based on approved receipts']);
      if (pending > 0)          alerts.push(['warn', pending + ' receipt' + (pending > 1 ? 's' : '') + ' waiting for review']);
      if (!alerts.length)       alerts.push(['ok', 'Everything looks on track']);

      var alertsEl = document.getElementById('bgt-alerts');
      if (alertsEl) {
        alertsEl.innerHTML = alerts.map(function (a) {
          return '<div class="bgt-alert-item bgt-alert-item--' + a[0] + '"><span class="bgt-alert-dot"></span>' + a[1] + '</div>';
        }).join('');
      }
    },
  };
})();
