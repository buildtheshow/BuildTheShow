/* budget-dashboard.js — Dashboard module */
(function () {
  'use strict';

  function moneyClass(cents) {
    return cents < 0 ? 'is-negative' : '';
  }

  window.BudgetDashboardModule = {

    init: function (prodId, container) {
      var s = window.BgtShared;
      s.BgtState.prodId = prodId;

      container.innerHTML =
        '<div class="bgt-fin-hero">' +
          '<div>' +
            '<div class="bgt-fin-kicker"><span class="bgt-fin-dot"></span><span>Financials</span><span>-</span><span>Dashboard</span></div>' +
            '<h1>Financials</h1>' +
          '</div>' +
          '<img class="bgt-fin-hero-icon" src="/ASSETS/Images/Icons/page-financials.svg" alt="" aria-hidden="true">' +
        '</div>' +

        '<section class="bgt-fin-panel bgt-fin-overview">' +
          '<div class="bgt-fin-title">Overview</div>' +
          '<div class="bgt-fin-stat-row">' +
            this._statCard('bgt-fin-income', '$0.00', 'Total Income', '$', 'income') +
            this._statCard('bgt-fin-expenses', '$0.00', 'Total Expenses', '↓', 'expenses') +
            this._statCard('bgt-fin-net', '$0.00', 'Net Position', '=', 'net') +
          '</div>' +
        '</section>' +

        '<div class="bgt-fin-grid">' +
          '<section class="bgt-fin-panel bgt-fin-chart-card">' +
            '<div class="bgt-fin-title">Income vs Expenses</div>' +
            '<div id="bgt-fin-chart" class="bgt-fin-chart">' + this._loading() + '</div>' +
          '</section>' +

          '<section class="bgt-fin-panel bgt-fin-budget-card">' +
            '<div class="bgt-fin-title">Budget Status</div>' +
            '<div id="bgt-fin-budget-status" class="bgt-fin-status">' + this._loading() + '</div>' +
          '</section>' +
        '</div>' +

        '<section class="bgt-fin-panel bgt-fin-activity-card">' +
          '<div class="bgt-fin-title">Recent Activity</div>' +
          '<div id="bgt-fin-activity" class="bgt-fin-activity">' + this._loading() + '</div>' +
        '</section>';

      this._load();
    },

    destroy: function () {},

    _statCard: function (id, value, label, icon, tone) {
      return '<div class="bgt-fin-stat bgt-fin-stat--' + tone + '">' +
        '<div class="bgt-fin-stat-icon">' + icon + '</div>' +
        '<div>' +
          '<div class="bgt-fin-stat-label">' + label + '</div>' +
          '<div id="' + id + '" class="bgt-fin-stat-value">' + value + '</div>' +
        '</div>' +
      '</div>';
    },

    _loading: function () {
      return '<div class="bgt-fin-muted">Loading...</div>';
    },

    _load: async function () {
      var s = window.BgtShared;
      var cats = [], rcts = [];
      try {
        var results = await Promise.all([
          s.dbFetch('budget_categories'),
          s.dbFetch('budget_receipts'),
        ]);
        cats = results[0] || [];
        rcts = results[1] || [];
      } catch (_) {}

      s.BgtState.categories = cats;
      s.BgtState.receipts = rcts;

      var totals = this._totals(cats, rcts);
      this._renderOverview(totals);
      this._renderChart(cats, rcts, totals);
      this._renderBudgetStatus(cats, rcts, totals);
      this._renderActivity(cats, rcts);
    },

    _totals: function (cats, rcts) {
      var plannedIncome = cats
        .filter(function (c) { return c.type === 'income'; })
        .reduce(function (sum, c) { return sum + (c.planned_cents || 0); }, 0);
      var plannedExpenses = cats
        .filter(function (c) { return c.type === 'expense'; })
        .reduce(function (sum, c) { return sum + (c.planned_cents || 0); }, 0);
      var approvedExpenses = rcts
        .filter(function (r) { return r.status === 'approved' || r.status === 'paid'; })
        .reduce(function (sum, r) { return sum + (r.amount_cents || 0); }, 0);
      var pendingExpenses = rcts
        .filter(function (r) { return r.status === 'pending'; })
        .reduce(function (sum, r) { return sum + (r.amount_cents || 0); }, 0);

      return {
        income: plannedIncome,
        expenses: approvedExpenses,
        plannedExpenses: plannedExpenses,
        approvedExpenses: approvedExpenses,
        pendingExpenses: pendingExpenses,
        net: plannedIncome - approvedExpenses,
        receiptCount: rcts.length,
        pendingCount: rcts.filter(function (r) { return r.status === 'pending'; }).length,
      };
    },

    _renderOverview: function (totals) {
      this._setText('bgt-fin-income', this._fmtMoney(totals.income));
      this._setText('bgt-fin-expenses', this._fmtMoney(totals.expenses));
      var netEl = document.getElementById('bgt-fin-net');
      if (netEl) {
        netEl.textContent = this._fmtMoney(totals.net);
        netEl.classList.toggle('is-negative', totals.net < 0);
      }
    },

    _renderChart: function (cats, rcts, totals) {
      var el = document.getElementById('bgt-fin-chart');
      if (!el) return;

      var months = this._lastMonths(6);
      var expenseByMonth = {};
      rcts.forEach(function (r) {
        if (!(r.status === 'approved' || r.status === 'paid')) return;
        var key = String(r.receipt_date || r.created_at || '').slice(0, 7);
        if (!key) return;
        expenseByMonth[key] = (expenseByMonth[key] || 0) + (r.amount_cents || 0);
      });
      var plannedIncomeMonthly = totals.income ? totals.income / Math.max(1, months.length) : 0;
      var incomeValues = months.map(function (m) { return plannedIncomeMonthly; });
      var expenseValues = months.map(function (m) { return expenseByMonth[m.key] || 0; });
      var max = Math.max(100, totals.income, totals.expenses, expenseValues.reduce(function (a, b) { return Math.max(a, b); }, 0));

      var incomePath = this._linePath(incomeValues, max);
      var expensePath = this._linePath(expenseValues, max);
      var labels = months.map(function (m, i) {
        var x = 50 + i * (520 / Math.max(1, months.length - 1));
        return '<text x="' + x + '" y="275" text-anchor="middle">' + m.label + '</text>';
      }).join('');

      el.innerHTML =
        '<svg class="bgt-fin-chart-svg" viewBox="0 0 620 300" role="img" aria-label="Income versus expenses chart">' +
          '<g class="bgt-fin-chart-grid">' +
            '<line x1="50" y1="35" x2="585" y2="35"></line>' +
            '<line x1="50" y1="85" x2="585" y2="85"></line>' +
            '<line x1="50" y1="135" x2="585" y2="135"></line>' +
            '<line x1="50" y1="185" x2="585" y2="185"></line>' +
            '<line x1="50" y1="235" x2="585" y2="235"></line>' +
          '</g>' +
          '<g class="bgt-fin-chart-axis">' +
            '<text x="18" y="239">$0</text>' +
            '<text x="18" y="189">' + this._fmtMoney(max * 0.25) + '</text>' +
            '<text x="18" y="139">' + this._fmtMoney(max * 0.5) + '</text>' +
            '<text x="18" y="89">' + this._fmtMoney(max * 0.75) + '</text>' +
            '<text x="18" y="39">' + this._fmtMoney(max) + '</text>' +
            labels +
          '</g>' +
          '<path class="bgt-fin-chart-line income" d="' + incomePath + '"></path>' +
          '<path class="bgt-fin-chart-line expenses" d="' + expensePath + '"></path>' +
        '</svg>' +
        '<div class="bgt-fin-legend"><span><i class="income"></i>Income</span><span><i class="expenses"></i>Expenses</span></div>';
    },

    _renderBudgetStatus: function (cats, rcts, totals) {
      var el = document.getElementById('bgt-fin-budget-status');
      if (!el) return;

      if (!cats.length) {
        el.innerHTML =
          '<div class="bgt-fin-empty-icon"><img src="/ASSETS/Images/Icons/Budgeting-total-spent-cad-usd.svg" alt="" aria-hidden="true"></div>' +
          '<h3>No budget created yet</h3>' +
          '<p>Create your first budget to start tracking income and expenses for your production.</p>' +
          '<button type="button" class="bgt-btn bgt-btn--primary" onclick="navigateToBudget(\'breakdown\')">+ Create Budget</button>';
        return;
      }

      var planned = totals.plannedExpenses;
      var spent = totals.approvedExpenses;
      var percent = planned > 0 ? Math.min(100, Math.round((spent / planned) * 100)) : 0;
      var remaining = planned - spent;
      var status = remaining < 0 ? 'Over budget' : percent >= 85 ? 'Watch closely' : 'On track';
      var statusClass = remaining < 0 ? 'danger' : percent >= 85 ? 'warn' : 'ok';

      el.innerHTML =
        '<div class="bgt-fin-status-summary">' +
          '<div class="bgt-fin-empty-icon"><img src="/ASSETS/Images/Icons/Budgeting-total-spent-cad-usd.svg" alt="" aria-hidden="true"></div>' +
          '<div>' +
            '<h3>' + status + '</h3>' +
            '<p>' + this._fmtMoney(spent) + ' spent of ' + this._fmtMoney(planned) + ' planned.</p>' +
          '</div>' +
        '</div>' +
        '<div class="bgt-fin-progress"><span class="' + statusClass + '" style="width:' + percent + '%"></span></div>' +
        '<div class="bgt-fin-status-meta">' +
          '<span>Remaining: <strong class="' + moneyClass(remaining) + '">' + this._fmtMoney(remaining) + '</strong></span>' +
          '<span>Pending: <strong>' + totals.pendingCount + '</strong></span>' +
        '</div>' +
        '<button type="button" class="bgt-btn bgt-btn--ghost" onclick="navigateToBudget(\'breakdown\')">View Budget</button>';
    },

    _renderActivity: function (cats, rcts) {
      var s = window.BgtShared;
      var el = document.getElementById('bgt-fin-activity');
      if (!el) return;

      var shown = rcts.slice(0, 5);
      if (!shown.length) {
        el.innerHTML =
          '<div class="bgt-fin-activity-empty">' +
            '<div class="bgt-fin-empty-icon small"><img src="/ASSETS/Images/Icons/Budgeting-Receipts.svg" alt="" aria-hidden="true"></div>' +
            '<div><h3>No recent activity</h3><p>Financial activity will appear here once you start adding income and expenses.</p></div>' +
          '</div>';
        return;
      }

      var self = this;
      el.innerHTML = shown.map(function (r) {
        var cat = cats.find(function (c) { return c.id === r.category_id; });
        var name = r.vendor || r.description || 'Receipt';
        var status = r.status || 'pending';
        var amount = self._fmtMoney(r.amount_cents || 0);
        return '<div class="bgt-fin-activity-row">' +
          '<div class="bgt-fin-activity-icon"><img src="/ASSETS/Images/Icons/Budgeting-Receipts.svg" alt="" aria-hidden="true"></div>' +
          '<div class="bgt-fin-activity-main">' +
            '<div class="bgt-fin-activity-title">' + s.esc(name) + ' <span>' + amount + '</span></div>' +
            '<div class="bgt-fin-activity-sub">' + s.esc(cat ? cat.name : 'Uncategorized') + ' - ' + s.esc(statusLabel(status)) + '</div>' +
          '</div>' +
          '<div class="bgt-fin-activity-date">' + s.fmtDate(String(r.receipt_date || r.created_at || '').slice(0, 10)) + '</div>' +
        '</div>';
      }).join('');

      function statusLabel(status) {
        return status === 'approved' ? 'Approved' : status === 'paid' ? 'Paid' : status === 'rejected' ? 'Rejected' : 'Pending';
      }
    },

    _lastMonths: function (count) {
      var out = [];
      var now = new Date();
      for (var i = count - 1; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        out.push({
          key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
          label: d.toLocaleDateString('en-CA', { month: 'short' }),
        });
      }
      return out;
    },

    _linePath: function (values, max) {
      if (!values.length) return '';
      return values.map(function (value, i) {
        var x = 50 + i * (520 / Math.max(1, values.length - 1));
        var y = 235 - (Math.max(0, value) / max) * 200;
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
    },

    _setText: function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    },

    _fmtMoney: function (cents) {
      var value = Number(cents || 0);
      var sign = value < 0 ? '-' : '';
      return sign + '$' + (Math.abs(value) / 100).toLocaleString('en-CA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
  };
})();
