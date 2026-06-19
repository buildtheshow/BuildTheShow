/* budget-receipts.js — Receipts page module */
(function () {
  'use strict';

  var _container = null;

  window.BudgetReceiptsModule = {

    init: function (prodId, container) {
      var s = window.BgtShared;
      s.BgtState.prodId = prodId;
      _container = container;

      container.innerHTML =
        '<div class="aud-visual-hero">' +
          '<div class="aud-visual-hero-content">' +
            '<div>' +
              '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span><span class="page-hierarchy"><span class="page-hierarchy-page">Financials</span></span></div>' +
              '<h1 class="aud-visual-title">Receipts</h1>' +
              '<p class="aud-visual-copy">Track every purchase. Add receipts manually or share the Collect link so your team can submit their own.</p>' +
            '</div>' +
            '<div class="aud-visual-total">' +
              '<div class="aud-visual-total-kicker">Receipts</div>' +
              '<div class="aud-visual-total-value" id="bgt-receipts-hero-count">—</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bgt-toolbar">' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">' +
            '<span class="bgt-toolbar-title" id="bgt-receipts-count">Receipts</span>' +
            '<select id="bgt-receipts-filter" onchange="BudgetReceiptsModule.filterReceipts()" style="padding:0.32rem 0.65rem;border:1.5px solid rgba(87,46,136,0.18);border-radius:8px;font-family:inherit;font-size:0.8rem;color:#572e88;font-weight:700;background:#fff">' +
              '<option value="all">All</option>' +
              '<option value="pending">Pending</option>' +
              '<option value="approved">Approved</option>' +
              '<option value="rejected">Rejected</option>' +
            '</select>' +
          '</div>' +
          '<button class="bgt-btn bgt-btn--primary" onclick="BudgetReceiptsModule.openReceiptModal()">+ Add Receipt</button>' +
        '</div>' +
        '<div class="bgt-list" id="bgt-receipts-list">' +
          '<div class="bgt-list-head bgt-receipt-cols"><span>Date</span><span>Vendor</span><span>Category</span><span>Amount</span><span>Submitted By</span><span>Status</span><span></span></div>' +
          '<div style="padding:1.5rem;color:#9a90b0">Loading...</div>' +
        '</div>' +
        '<div class="bgt-modal-overlay" id="bgt-receipt-modal">' +
          '<div class="bgt-modal">' +
            '<div class="bgt-modal-title" id="bgt-receipt-modal-title">Add Receipt</div>' +
            '<input type="hidden" id="bgt-receipt-id" />' +
            '<div class="bgt-row-2">' +
              '<div class="bgt-field"><label>Submitted By *</label><input type="text" id="bgt-receipt-name" placeholder="Name" /></div>' +
              '<div class="bgt-field"><label>Email</label><input type="email" id="bgt-receipt-email" placeholder="email@example.com" /></div>' +
            '</div>' +
            '<div class="bgt-row-2">' +
              '<div class="bgt-field"><label>Department / Category *</label><select id="bgt-receipt-cat"></select></div>' +
              '<div class="bgt-field"><label>Date</label><input type="date" id="bgt-receipt-date" /></div>' +
            '</div>' +
            '<div class="bgt-row-2">' +
              '<div class="bgt-field"><label>Vendor / Store</label><input type="text" id="bgt-receipt-vendor" placeholder="Where was it purchased?" /></div>' +
              '<div class="bgt-field"><label>Amount ($) *</label><input type="number" id="bgt-receipt-amount" min="0" step="0.01" placeholder="0.00" /></div>' +
            '</div>' +
            '<div class="bgt-field"><label>What was it for?</label><textarea id="bgt-receipt-desc" placeholder="Brief description of the purchase..."></textarea></div>' +
            '<div class="bgt-field"><label>Notes</label><textarea id="bgt-receipt-notes" placeholder="Any extra context..." style="min-height:52px"></textarea></div>' +
            '<div class="bgt-field"><label>Status</label><select id="bgt-receipt-status"><option value="pending">Pending Review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>' +
            '<div class="bgt-modal-footer">' +
              '<button class="bgt-btn bgt-btn--ghost" onclick="BudgetReceiptsModule.closeReceiptModal()">Cancel</button>' +
              '<button class="bgt-btn bgt-btn--primary" onclick="BudgetReceiptsModule.saveReceipt()">Save Receipt</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var overlay = document.getElementById('bgt-receipt-modal');
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
        try { s.BgtState.categories = await s.dbFetch('budget_categories'); } catch (_) {}
      }
      try {
        s.BgtState.receipts = await s.dbFetch('budget_receipts', '&order=created_at.desc');
      } catch (_) { s.BgtState.receipts = []; }
      this._render();
    },

    _render: function () {
      var s      = window.BgtShared;
      var filter = (document.getElementById('bgt-receipts-filter') || {}).value || 'all';
      var all    = s.BgtState.receipts;
      var list   = filter === 'all' ? all : all.filter(function (r) { return r.status === filter; });

      var heroEl = document.getElementById('bgt-receipts-hero-count');
      if (heroEl) heroEl.textContent = all.length;

      var countEl = document.getElementById('bgt-receipts-count');
      if (countEl) countEl.textContent = list.length + ' Receipt' + (list.length !== 1 ? 's' : '');

      function badge(status) {
        var map = { pending: ['pending','Pending'], approved: ['approved','Approved'], rejected: ['rejected','Rejected'] };
        var pair = map[status] || ['pending', status];
        return '<span class="bgt-badge bgt-badge--' + pair[0] + '">' + pair[1] + '</span>';
      }

      var head = '<div class="bgt-list-head bgt-receipt-cols"><span>Date</span><span>Vendor</span><span>Category</span><span>Amount</span><span>Submitted By</span><span>Status</span><span></span></div>';
      var listEl = document.getElementById('bgt-receipts-list');
      if (!listEl) return;

      if (!list.length) {
        listEl.innerHTML = head + '<div class="bgt-list-empty"><div class="bgt-empty">' +
          '<div class="bgt-empty-icon">&#x1F9FE;</div>' +
          '<h3>No receipts yet</h3>' +
          '<p>Add receipts manually or share the Collect link so your team can submit their own.</p>' +
          '</div></div>';
        return;
      }

      listEl.innerHTML = head + list.map(function (r) {
        var desc = r.description && r.vendor ? '<div class="bgt-list-sub">' + s.esc(r.description) + '</div>' : '';
        var pending = r.status === 'pending'
          ? '<button class="bgt-btn bgt-btn--green bgt-btn--sm" onclick="BudgetReceiptsModule.approveReceipt(\'' + r.id + '\')">Approve</button>' +
            '<button class="bgt-btn bgt-btn--danger bgt-btn--sm" onclick="BudgetReceiptsModule.rejectReceipt(\'' + r.id + '\')">Reject</button>'
          : '';
        return '<div class="bgt-list-row bgt-receipt-cols">' +
          '<div class="bgt-list-sub">' + s.fmtDate(r.receipt_date) + '</div>' +
          '<div><div class="bgt-list-name">' + s.esc(r.vendor || r.description || 'Receipt') + '</div>' + desc + '</div>' +
          '<div class="bgt-list-sub">' + s.esc(s.catName(r.category_id)) + '</div>' +
          '<div class="bgt-list-sub">' + s.fmt$(r.amount_cents) + '</div>' +
          '<div class="bgt-list-sub">' + s.esc(r.submitted_by_name || '') + '</div>' +
          '<div>' + badge(r.status) + '</div>' +
          '<div class="bgt-row-actions">' +
            pending +
            '<button class="bgt-btn bgt-btn--ghost bgt-btn--sm" onclick="BudgetReceiptsModule.openReceiptModal(\'' + r.id + '\')">Edit</button>' +
            '<button class="bgt-btn bgt-btn--danger bgt-btn--sm" onclick="BudgetReceiptsModule.deleteReceipt(\'' + r.id + '\')">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');
    },

    filterReceipts: function () { this._render(); },

    approveReceipt: async function (id) {
      var s = window.BgtShared;
      try { await s.dbUpdate('budget_receipts', id, { status: 'approved' }); s.BgtState.receipts = []; await this._load(); }
      catch (e) { alert('Could not update: ' + e.message); }
    },

    rejectReceipt: async function (id) {
      var s = window.BgtShared;
      try { await s.dbUpdate('budget_receipts', id, { status: 'rejected' }); s.BgtState.receipts = []; await this._load(); }
      catch (e) { alert('Could not update: ' + e.message); }
    },

    openReceiptModal: function (id) {
      var s = window.BgtShared;
      var r = id ? s.BgtState.receipts.find(function (x) { return x.id === id; }) : null;
      document.getElementById('bgt-receipt-modal-title').textContent = r ? 'Edit Receipt' : 'Add Receipt';
      document.getElementById('bgt-receipt-id').value     = id || '';
      document.getElementById('bgt-receipt-name').value   = (r && r.submitted_by_name)  || '';
      document.getElementById('bgt-receipt-email').value  = (r && r.submitted_by_email) || '';
      document.getElementById('bgt-receipt-date').value   = (r && r.receipt_date)       || '';
      document.getElementById('bgt-receipt-vendor').value = (r && r.vendor)             || '';
      document.getElementById('bgt-receipt-amount').value = r ? ((r.amount_cents || 0) / 100).toFixed(2) : '';
      document.getElementById('bgt-receipt-desc').value   = (r && r.description)        || '';
      document.getElementById('bgt-receipt-notes').value  = (r && r.notes)              || '';
      document.getElementById('bgt-receipt-status').value = (r && r.status)             || 'pending';

      var catSel  = document.getElementById('bgt-receipt-cat');
      var expCats = s.BgtState.categories.filter(function (c) { return c.type === 'expense'; });
      catSel.innerHTML = '<option value="">Select department...</option>' +
        expCats.map(function (c) {
          return '<option value="' + c.id + '"' + (r && r.category_id === c.id ? ' selected' : '') + '>' + s.esc(c.name) + '</option>';
        }).join('');

      document.getElementById('bgt-receipt-modal').classList.add('open');
    },

    closeReceiptModal: function () {
      document.getElementById('bgt-receipt-modal').classList.remove('open');
    },

    saveReceipt: async function () {
      var s      = window.BgtShared;
      var name   = document.getElementById('bgt-receipt-name').value.trim();
      var amount = parseFloat(document.getElementById('bgt-receipt-amount').value);
      if (!name)         { alert('Submitted by name is required.'); return; }
      if (isNaN(amount)) { alert('Amount is required.'); return; }
      var id = document.getElementById('bgt-receipt-id').value;
      var payload = {
        submitted_by_name:  name,
        submitted_by_email: document.getElementById('bgt-receipt-email').value.trim()  || null,
        category_id:        document.getElementById('bgt-receipt-cat').value           || null,
        receipt_date:       document.getElementById('bgt-receipt-date').value          || null,
        vendor:             document.getElementById('bgt-receipt-vendor').value.trim() || null,
        amount_cents:       Math.round(amount * 100),
        description:        document.getElementById('bgt-receipt-desc').value.trim()   || null,
        notes:              document.getElementById('bgt-receipt-notes').value.trim()   || null,
        status:             document.getElementById('bgt-receipt-status').value,
      };
      try {
        if (id) await s.dbUpdate('budget_receipts', id, payload);
        else    await s.dbInsert('budget_receipts', payload);
        this.closeReceiptModal();
        s.BgtState.receipts = [];
        await this._load();
      } catch (e) { alert('Could not save: ' + e.message); }
    },

    deleteReceipt: async function (id) {
      var s = window.BgtShared;
      if (!confirm('Delete this receipt? This cannot be undone.')) return;
      try { await s.dbDelete('budget_receipts', id); s.BgtState.receipts = []; await this._load(); }
      catch (e) { alert('Could not delete: ' + e.message); }
    },
  };
})();
