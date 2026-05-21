/* budget-dashboard.js — Dashboard page module */
(function () {
  'use strict';

  window.BudgetDashboardModule = {

    init: function (prodId, container) {
      var s = window.BgtShared;
      s.BgtState.prodId = prodId;

      container.innerHTML = [
        '<div class="bgt-stat-grid" id="bgt-stats">',
          '<div class="bgt-stat"><div class="bgt-stat-label">Planned Income</div><div class="bgt-stat-value">...</div></div>',
          '<div class="bgt-stat"><div class="bgt-stat-label">Planned Expenses</div><div class="bgt-stat-value">...</div></div>',
          '<div class="bgt-stat"><div class="bgt-stat-label">Net Position</div><div class="bgt-stat-value">...</div></div>',
          '<div class="bgt-stat"><div class="bgt-stat-label">Actual Spent</div><div class="bgt-stat-value">...</div></div>',
          '<div class="bgt-stat"><div class="bgt-stat-label">Budget Remaining</div><div class="bgt-stat-value">...</div></div>',
          '<div class="bgt-stat"><div class="bgt-stat-label">Pending Receipts</div><div class="bgt-stat-value">...</div></div>',
          '<div class="bgt-stat"><div class="bgt-stat-label">Total Receipts</div><div class="bgt-stat-value">...</div></div>',
          '<div class="bgt-stat"><div class="bgt-stat-label">Expense Categories</div><div class="bgt-stat-value">...</div></div>',
        '</div>',
        '<div class="bgt-card">',
          '<div class="bgt-card-title">Needs attention</div>',
          '<div id="bgt-alerts" class="bgt-alert-list"><div style="color:#9a90b0;font-size:0.85rem">Loading...</div></div>',
        '</div>',
      ].join('');

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

      function mkStat(label, val, sub, mod) {
        return '<div class="bgt-stat' + (mod ? ' bgt-stat--' + mod : '') + '">' +
          '<div class="bgt-stat-label">' + label + '</div>' +
          '<div class="bgt-stat-value">' + val + '</div>' +
          '<div class="bgt-stat-sub">' + sub + '</div>' +
        '</div>';
      }

      var statsEl = document.getElementById('bgt-stats');
      if (statsEl) {
        statsEl.innerHTML = [
          mkStat('Planned Income',    s.fmt$(income),    'Total income plan',    income > 0 ? 'good' : ''),
          mkStat('Planned Expenses',  s.fmt$(expenses),  'Total expense plan',   ''),
          mkStat('Net Position',      s.fmt$(net),       net >= 0 ? 'Surplus' : 'Deficit', net >= 0 ? 'good' : 'alert'),
          mkStat('Actual Spent',      s.fmt$(approved),  'Approved receipts',    ''),
          mkStat('Budget Remaining',  s.fmt$(remaining), 'Planned − actual', remaining < 0 ? 'alert' : remaining < expenses * 0.2 ? 'warn' : 'good'),
          mkStat('Pending Receipts',  pending,           'Awaiting review',      pending > 0 ? 'warn' : ''),
          mkStat('Total Receipts',    rcts.length,       'All submissions',      ''),
          mkStat('Expense Categories', cats.filter(function (c) { return c.type === 'expense'; }).length, 'Tracking', ''),
        ].join('');
      }

      var alerts = [];
      if (!cats.length)         alerts.push(['warn', 'No budget categories set up yet']);
      if (net < 0 && cats.length) alerts.push(['err',  'Budget is in deficit by ' + s.fmt$(Math.abs(net))]);
      if (remaining < 0)        alerts.push(['err',  'Overspent by ' + s.fmt$(Math.abs(remaining)) + ' based on approved receipts']);
      if (pending > 0)          alerts.push(['warn', pending + ' receipt' + (pending > 1 ? 's' : '') + ' waiting for review']);
      if (!alerts.length)       alerts.push(['ok',   'Everything looks on track']);

      var alertsEl = document.getElementById('bgt-alerts');
      if (alertsEl) {
        alertsEl.innerHTML = alerts.map(function (a) {
          return '<div class="bgt-alert-item bgt-alert-item--' + a[0] + '"><span class="bgt-alert-dot"></span>' + a[1] + '</div>';
        }).join('');
      }
    },
  };
})();
