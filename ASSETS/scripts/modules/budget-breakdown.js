/* budget-breakdown.js — Breakdown module (income/expense categories) */
(function () {
  'use strict';

  var _container = null;

  window.BudgetBreakdownModule = {

    init: function (prodId, container) {
      var s = window.BgtShared;
      s.BgtState.prodId = prodId;
      _container = container;

      container.innerHTML =
        '<div class="aud-visual-hero">' +
          '<div class="aud-visual-hero-content">' +
            '<div>' +
              '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span>Budgeting</div>' +
              '<h1 class="aud-visual-title">Breakdown.</h1>' +
              '<p class="aud-visual-copy">Plan your income and expense categories. Set amounts, track actuals, and keep the budget on course.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="bgt-budget-content"><div style="color:#9a90b0;padding:2rem;text-align:center">Loading...</div></div>' +
        '<div class="bgt-modal-overlay" id="bgt-cat-modal">' +
          '<div class="bgt-modal">' +
            '<div class="bgt-modal-title" id="bgt-cat-modal-title">Add Category</div>' +
            '<input type="hidden" id="bgt-cat-id" />' +
            '<input type="hidden" id="bgt-cat-type" />' +
            '<div class="bgt-field"><label>Category Name *</label><input type="text" id="bgt-cat-name" placeholder="e.g. Costumes" /></div>' +
            '<div class="bgt-field"><label>Planned Amount ($)</label><input type="number" id="bgt-cat-planned" min="0" step="0.01" placeholder="0.00" /></div>' +
            '<div class="bgt-modal-footer">' +
              '<button class="bgt-btn bgt-btn--ghost" onclick="BudgetBreakdownModule.closeCatModal()">Cancel</button>' +
              '<button class="bgt-btn bgt-btn--primary" onclick="BudgetBreakdownModule.saveCat()">Save</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var overlay = document.getElementById('bgt-cat-modal');
      if (overlay) {
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('open'); });
      }

      this._load();
    },

    destroy: function () {
      _container = null;
    },

    _load: async function () {
      var s = window.BgtShared;
      if (!s.BgtState.categories.length) {
        try { s.BgtState.categories = await s.dbFetch('budget_categories'); } catch (_) { s.BgtState.categories = []; }
      }
      if (!s.BgtState.receipts.length) {
        try { s.BgtState.receipts = await s.dbFetch('budget_receipts', '&status=eq.approved'); } catch (_) { s.BgtState.receipts = []; }
      }
      this._render();
    },

    _render: function () {
      var s = window.BgtShared;
      var cats    = s.BgtState.categories;
      var income  = cats.filter(function (c) { return c.type === 'income'; });
      var expense = cats.filter(function (c) { return c.type === 'expense'; });
      var el = document.getElementById('bgt-budget-content');
      if (!el) return;

      if (!cats.length) {
        el.innerHTML = '<div class="bgt-card"><div class="bgt-empty">' +
          '<div class="bgt-empty-icon">&#128202;</div>' +
          '<h3>No budget categories yet</h3>' +
          '<p>Load the standard starter categories or add your own.</p>' +
          '<button class="bgt-btn bgt-btn--primary" onclick="BudgetBreakdownModule.loadStarter()">Load Starter Template</button>' +
          '</div></div>';
        return;
      }

      var approvedByCategory = {};
      s.BgtState.receipts.filter(function (r) { return r.status === 'approved'; }).forEach(function (r) {
        if (r.category_id) approvedByCategory[r.category_id] = (approvedByCategory[r.category_id] || 0) + (r.amount_cents || 0);
      });

      var totalIncome  = income.reduce(function (a, c) { return a + (c.planned_cents || 0); }, 0);
      var totalExpense = expense.reduce(function (a, c) { return a + (c.planned_cents || 0); }, 0);
      var net = totalIncome - totalExpense;

      function incomeRow(c) {
        return '<div class="bgt-list-row bgt-income-cols">' +
          '<div class="bgt-list-name">' + s.esc(c.name) + '</div>' +
          '<div style="display:flex;align-items:center;gap:0.4rem">' +
            '<span style="font-size:0.82rem;font-weight:600;color:#9a90b0">$</span>' +
            '<input class="bgt-amount-input" type="number" min="0" step="0.01" value="' + ((c.planned_cents || 0) / 100).toFixed(2) + '" onchange="BudgetBreakdownModule.updatePlanned(\'' + c.id + '\',this.value)" />' +
          '</div>' +
          '<div class="bgt-row-actions">' +
            '<button class="bgt-btn bgt-btn--ghost bgt-btn--sm" onclick="BudgetBreakdownModule.openCatModal(\'' + c.id + '\',\'income\')">Edit</button>' +
            '<button class="bgt-btn bgt-btn--danger bgt-btn--sm" onclick="BudgetBreakdownModule.deleteCat(\'' + c.id + '\',\'' + s.esc(c.name) + '\')">Delete</button>' +
          '</div>' +
        '</div>';
      }

      function expenseRow(c) {
        var actual    = approvedByCategory[c.id] || 0;
        var planned   = c.planned_cents || 0;
        var remaining = planned - actual;
        var remColor  = remaining < 0 ? '#d1523d' : remaining < planned * 0.2 ? '#dd8233' : '#769e7b';
        return '<div class="bgt-list-row bgt-expense-cols">' +
          '<div class="bgt-list-name">' + s.esc(c.name) + '</div>' +
          '<div style="display:flex;align-items:center;gap:0.4rem">' +
            '<span style="font-size:0.82rem;font-weight:600;color:#9a90b0">$</span>' +
            '<input class="bgt-amount-input" type="number" min="0" step="0.01" value="' + (planned / 100).toFixed(2) + '" onchange="BudgetBreakdownModule.updatePlanned(\'' + c.id + '\',this.value)" />' +
          '</div>' +
          '<div class="bgt-list-sub" style="text-align:right">' + s.fmt$(actual) + '</div>' +
          '<div class="bgt-list-sub" style="text-align:right;color:' + remColor + '">' + s.fmt$(remaining) + '</div>' +
          '<div class="bgt-row-actions">' +
            '<button class="bgt-btn bgt-btn--ghost bgt-btn--sm" onclick="BudgetBreakdownModule.openCatModal(\'' + c.id + '\',\'expense\')">Edit</button>' +
            '<button class="bgt-btn bgt-btn--danger bgt-btn--sm" onclick="BudgetBreakdownModule.deleteCat(\'' + c.id + '\',\'' + s.esc(c.name) + '\')">Delete</button>' +
          '</div>' +
        '</div>';
      }

      var noIncome  = '<div class="bgt-list-empty"><div style="padding:1rem;color:#9a90b0;font-size:0.85rem">No income categories yet.</div></div>';
      var noExpense = '<div class="bgt-list-empty"><div style="padding:1rem;color:#9a90b0;font-size:0.85rem">No expense categories yet.</div></div>';
      var netClass  = net >= 0 ? 'bgt-net-value--good' : 'bgt-net-value--bad';

      el.innerHTML = '<div class="bgt-card">' +
        '<div class="bgt-section">' +
          '<div class="bgt-section-header">' +
            '<div class="bgt-section-title">Income</div>' +
            '<div style="display:flex;align-items:center;gap:0.75rem">' +
              '<span class="bgt-section-total">Planned: ' + s.fmt$(totalIncome) + '</span>' +
              '<button class="bgt-btn bgt-btn--ghost bgt-btn--sm" onclick="BudgetBreakdownModule.openCatModal(null,\'income\')">+ Add</button>' +
            '</div>' +
          '</div>' +
          '<div class="bgt-list">' +
            '<div class="bgt-list-head bgt-income-cols"><span>Category</span><span>Planned</span><span></span></div>' +
            (income.length ? income.map(incomeRow).join('') : noIncome) +
          '</div>' +
        '</div>' +
        '<div class="bgt-section">' +
          '<div class="bgt-section-header">' +
            '<div class="bgt-section-title">Expenses</div>' +
            '<div style="display:flex;align-items:center;gap:0.75rem">' +
              '<span class="bgt-section-total">Planned: ' + s.fmt$(totalExpense) + '</span>' +
              '<button class="bgt-btn bgt-btn--ghost bgt-btn--sm" onclick="BudgetBreakdownModule.openCatModal(null,\'expense\')">+ Add</button>' +
            '</div>' +
          '</div>' +
          '<div class="bgt-list">' +
            '<div class="bgt-list-head bgt-expense-cols"><span>Category</span><span>Planned</span><span>Actual</span><span>Remaining</span><span></span></div>' +
            (expense.length ? expense.map(expenseRow).join('') : noExpense) +
          '</div>' +
        '</div>' +
        '<div class="bgt-net">' +
          '<div class="bgt-net-cell"><div class="bgt-net-label">Total Planned Income</div><div class="bgt-net-value bgt-net-value--good">' + s.fmt$(totalIncome) + '</div></div>' +
          '<div class="bgt-net-cell"><div class="bgt-net-label">Total Planned Expenses</div><div class="bgt-net-value">' + s.fmt$(totalExpense) + '</div></div>' +
          '<div class="bgt-net-cell"><div class="bgt-net-label">Net Position</div><div class="bgt-net-value ' + netClass + '">' + s.fmt$(net) + ' ' + (net >= 0 ? '(surplus)' : '(deficit)') + '</div></div>' +
        '</div>' +
      '</div>';
    },

    loadStarter: async function () {
      var s = window.BgtShared;
      if (!confirm('Load the standard starter categories? This will add them to your budget. You can delete or rename any you don\'t need.')) return;
      try {
        var rows = [];
        s.STARTER_CATEGORIES.income.forEach(function (name, i) { rows.push({ name: name, type: 'income', planned_cents: 0, sort_order: i, production_id: s.BgtState.prodId }); });
        s.STARTER_CATEGORIES.expense.forEach(function (name, i) { rows.push({ name: name, type: 'expense', planned_cents: 0, sort_order: i, production_id: s.BgtState.prodId }); });
        var r = await fetch(s.SUPABASE_URL + '/rest/v1/budget_categories', {
          method: 'POST',
          headers: { apikey: s.SUPABASE_ANON, Authorization: 'Bearer ' + s.SUPABASE_ANON, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(rows),
        });
        if (!r.ok) throw new Error(await r.text());
        s.BgtState.categories = [];
        await this._load();
      } catch (e) { alert('Could not load starter: ' + e.message); }
    },

    updatePlanned: async function (id, val) {
      var s = window.BgtShared;
      var cents = Math.round((parseFloat(val) || 0) * 100);
      try {
        await s.dbUpdate('budget_categories', id, { planned_cents: cents });
        var c = s.BgtState.categories.find(function (x) { return x.id === id; });
        if (c) c.planned_cents = cents;
      } catch (e) { alert('Could not save: ' + e.message); }
    },

    openCatModal: function (id, type) {
      var s = window.BgtShared;
      var c = id ? s.BgtState.categories.find(function (x) { return x.id === id; }) : null;
      document.getElementById('bgt-cat-modal-title').textContent = c ? 'Edit Category' : 'Add ' + (type === 'income' ? 'Income' : 'Expense') + ' Category';
      document.getElementById('bgt-cat-id').value      = id || '';
      document.getElementById('bgt-cat-type').value    = (c && c.type) || type;
      document.getElementById('bgt-cat-name').value    = (c && c.name) || '';
      document.getElementById('bgt-cat-planned').value = c ? ((c.planned_cents || 0) / 100).toFixed(2) : '';
      document.getElementById('bgt-cat-modal').classList.add('open');
    },

    closeCatModal: function () {
      document.getElementById('bgt-cat-modal').classList.remove('open');
    },

    saveCat: async function () {
      var s = window.BgtShared;
      var name = document.getElementById('bgt-cat-name').value.trim();
      if (!name) { alert('Category name is required.'); return; }
      var id   = document.getElementById('bgt-cat-id').value;
      var type = document.getElementById('bgt-cat-type').value;
      var payload = {
        name: name,
        type: type,
        planned_cents: Math.round((parseFloat(document.getElementById('bgt-cat-planned').value) || 0) * 100),
      };
      try {
        if (id) await s.dbUpdate('budget_categories', id, payload);
        else    await s.dbInsert('budget_categories', payload);
        this.closeCatModal();
        s.BgtState.categories = [];
        await this._load();
      } catch (e) { alert('Could not save: ' + e.message); }
    },

    deleteCat: async function (id, name) {
      var s = window.BgtShared;
      if (!confirm('Delete "' + name + '"? Any receipts linked to it will lose their category.')) return;
      try {
        await s.dbDelete('budget_categories', id);
        s.BgtState.categories = [];
        await this._load();
      } catch (e) { alert('Could not delete: ' + e.message); }
    },
  };
})();
