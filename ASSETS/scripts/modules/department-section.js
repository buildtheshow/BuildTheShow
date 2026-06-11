/* department-section.js - reusable production department section page */
(function () {
  'use strict';

  const URL = window.SUPABASE_URL || 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  const KEY = window.SUPABASE_ANON_KEY || '';

  const state = {
    prodId: '',
    group: null,
    section: null,
    tab: 'dashboard',
    categories: [],
    receipts: [],
    editingReceiptId: '',
  };

  function esc(value) {
    return value == null ? '' : String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function headers(json) {
    const out = { apikey: KEY, Authorization: 'Bearer ' + KEY };
    if (json) {
      out['Content-Type'] = 'application/json';
      out.Prefer = 'return=representation';
    }
    return out;
  }

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function fmtMoney(cents) {
    const amount = (parseInt(cents, 10) || 0) / 100;
    return '$' + amount.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function fmtDate(date) {
    if (!date) return 'No date';
    const parsed = new Date(date + 'T12:00:00');
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function config() {
    return window.BTSDepartmentConfig;
  }

  function setRoute(tab) {
    state.tab = tab || 'dashboard';
    const next = new URL(window.location.href);
    next.searchParams.set('group', state.group.key);
    next.searchParams.set('section', state.section.key);
    next.searchParams.set('tab', state.tab);
    window.history.replaceState({}, '', next.toString());
    render();
  }

  function categoryAliases() {
    return [state.section.label].concat(state.section.categoryAliases || []);
  }

  function norm(value) {
    return String(value || '').trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');
  }

  function sectionCategories() {
    const aliases = categoryAliases().map(norm);
    return state.categories.filter(function (cat) {
      const name = norm(cat.name);
      return aliases.some(function (alias) {
        return name === alias || name.includes(alias) || alias.includes(name);
      });
    });
  }

  function sectionReceipts() {
    const ids = new Set(sectionCategories().map(function (cat) { return cat.id; }));
    return state.receipts.filter(function (receipt) { return ids.has(receipt.category_id); });
  }

  function receiptSubmitter(receipt) {
    return receipt.submitted_by_name || receipt.submitted_by || receipt.submitted_by_email || 'No submitter';
  }

  function receiptTitle(receipt) {
    return receipt.vendor || receipt.description || 'Receipt';
  }

  function statusLabel(status) {
    const labels = { pending: 'Pending', approved: 'Approved', paid: 'Paid', rejected: 'Rejected' };
    return labels[status] || status || 'Pending';
  }

  function metricTile(kicker, value, label, color) {
    const renderer = window.BTSAuditionTemplates && window.BTSAuditionTemplates.renderBrandTileTemplate;
    if (renderer) {
      return renderer({
        variant: 'square',
        mode: 'metric',
        kicker,
        metricValue: value,
        metricLabel: label,
        progressPercent: '100%',
        style: '--brand-tile-bg:' + color + ';--brand-tile-ink:#ffffff;',
      });
    }
    return '<div class="dept-panel"><div class="dept-panel-sub">' + esc(kicker) + '</div><div class="dept-panel-title">' + esc(value) + '</div><div class="dept-panel-sub">' + esc(label) + '</div></div>';
  }

  async function fetchTable(table, extra) {
    if (!KEY || !state.prodId) return [];
    const response = await fetch(URL + '/rest/v1/' + table + '?production_id=eq.' + encodeURIComponent(state.prodId) + (extra || ''), { headers: headers() });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async function loadData() {
    try {
      const results = await Promise.all([
        fetchTable('budget_categories', '&type=eq.expense&order=sort_order.asc,created_at.asc'),
        fetchTable('budget_receipts', '&order=created_at.desc'),
      ]);
      state.categories = results[0] || [];
      state.receipts = results[1] || [];
    } catch (error) {
      console.warn('[BTS] Department section data failed:', error);
      state.categories = [];
      state.receipts = [];
    }
  }

  function renderHero() {
    const hierarchy = [
      '<span class="page-hierarchy-page">Production Departments</span>',
      '<span class="page-hierarchy-sep">-</span>',
      '<span class="page-hierarchy-sub">' + esc(state.group.label) + '</span>',
      '<span class="page-hierarchy-sep">-</span>',
      '<span class="page-hierarchy-sub">' + esc(state.section.label) + '</span>',
    ].join('');
    return '<div class="aud-visual-hero dept-hero" style="--dept-color:' + esc(state.group.color) + ';">' +
      '<div class="aud-visual-hero-content"><div>' +
        '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span><span class="page-hierarchy">' + hierarchy + '</span></div>' +
        '<h1 class="aud-visual-title">' + esc(state.section.label) + '</h1>' +
        '<p class="aud-visual-copy">' + esc(state.section.description) + '</p>' +
      '</div></div>' +
      '<div class="dept-hero-deco"><img src="' + esc(state.group.icon) + '" alt="" /></div>' +
    '</div>';
  }

  function renderTabs() {
    return '<div class="dept-tabs" role="tablist">' + config().tabs.map(function (tab) {
      return '<button type="button" class="dept-tab' + (tab.key === state.tab ? ' active' : '') + '" onclick="BTSDepartmentSection.openTab(\'' + esc(tab.key) + '\')" role="tab" aria-selected="' + (tab.key === state.tab ? 'true' : 'false') + '">' + esc(tab.label) + '</button>';
    }).join('') + '</div>';
  }

  function renderDashboard() {
    const receipts = sectionReceipts();
    const pending = receipts.filter(function (receipt) { return receipt.status === 'pending'; });
    const approved = receipts.filter(function (receipt) { return receipt.status === 'approved' || receipt.status === 'paid'; });
    const spend = approved.reduce(function (sum, receipt) { return sum + (receipt.amount_cents || 0); }, 0);
    const cats = sectionCategories();
    return '<div class="dept-page-grid">' +
      '<div class="dept-tile-grid">' +
        metricTile('Section', String(cats.length), cats.length === 1 ? 'Budget category linked' : 'Budget categories linked', state.group.color) +
        metricTile('Receipts', String(receipts.length), 'Section receipts', '#476aaa') +
        metricTile('Pending', String(pending.length), 'Awaiting review', '#efab45') +
        metricTile('Approved', fmtMoney(spend), 'Approved or paid spend', '#769e7b') +
      '</div>' +
      '<section class="dept-panel">' +
        '<div class="dept-panel-head"><div><div class="dept-panel-title">Current Focus</div><div class="dept-panel-sub">' + esc(state.section.description) + '</div></div><button class="dept-action secondary" onclick="BTSDepartmentSection.openTab(\'planning\')">Open Planning</button></div>' +
        renderPlanningList(false) +
      '</section>' +
      '<section class="dept-panel">' +
        '<div class="dept-panel-head"><div><div class="dept-panel-title">Recent Receipts</div><div class="dept-panel-sub">Only receipts attached to this section category appear here.</div></div><button class="dept-action secondary" onclick="BTSDepartmentSection.openTab(\'receipts\')">Open Receipts</button></div>' +
        renderReceiptList(receipts.slice(0, 4), false) +
      '</section>' +
    '</div>';
  }

  function renderPlanningList(showTitle) {
    const items = state.section.planning || [];
    return (showTitle ? '<div class="dept-panel-sub" style="margin-bottom:0.75rem;">Use this as the section working checklist. Detailed task storage can plug into the shared task system when that data model is ready.</div>' : '') +
      '<div class="dept-list">' + items.map(function (item) {
        return '<div class="dept-list-item"><div><div class="dept-list-title">' + esc(item) + '</div><div class="dept-list-meta">' + esc(state.section.label) + ' - planning item</div></div><span class="dept-status">Plan</span></div>';
      }).join('') + '</div>';
  }

  function renderPlanning() {
    return '<section class="dept-panel">' +
      '<div class="dept-panel-head"><div><div class="dept-panel-title">' + esc(state.section.label) + ' Planning</div><div class="dept-panel-sub">Section-specific planning, without mixing this work into the parent department group.</div></div></div>' +
      renderPlanningList(true) +
    '</section>';
  }

  function renderReceiptList(receipts, includeActions) {
    if (!receipts.length) {
      return '<div class="dept-empty">No receipts are linked to ' + esc(state.section.label) + ' yet.</div>';
    }
    return '<div class="dept-list">' + receipts.map(function (receipt) {
      return '<div class="dept-list-item">' +
        '<div><div class="dept-list-title">' + esc(receiptTitle(receipt)) + ' - ' + esc(fmtMoney(receipt.amount_cents)) + '</div>' +
        '<div class="dept-list-meta">' + esc(fmtDate(receipt.receipt_date)) + ' - ' + esc(receiptSubmitter(receipt)) + (receipt.description ? ' - ' + esc(receipt.description) : '') + '</div></div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;justify-content:flex-end;flex-wrap:wrap;">' +
          '<span class="dept-status ' + esc(receipt.status || 'pending') + '">' + esc(statusLabel(receipt.status)) + '</span>' +
          (includeActions ? '<button type="button" class="dept-action secondary" onclick="BTSDepartmentSection.openReceiptModal(\'' + esc(receipt.id) + '\')">Edit</button>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderReceipts() {
    const cats = sectionCategories();
    const receipts = sectionReceipts();
    const setup = cats.length ? '' : '<div class="dept-empty">No budget category exists for ' + esc(state.section.label) + ' yet. Create one here so receipts can belong to this section instead of the parent department.</div>';
    return '<section class="dept-panel">' +
      '<div class="dept-panel-head"><div><div class="dept-panel-title">' + esc(state.section.label) + ' Receipts</div><div class="dept-panel-sub">Receipts are filtered by this section budget category.</div></div><div style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end;">' +
        (cats.length ? '<button class="dept-action" onclick="BTSDepartmentSection.openReceiptModal()">Add Receipt</button>' : '<button class="dept-action" onclick="BTSDepartmentSection.createCategory()">Create Category</button>') +
      '</div></div>' +
      setup +
      (cats.length ? renderReceiptList(receipts, true) : '') +
    '</section>';
  }

  function renderContent() {
    if (state.tab === 'planning') return renderPlanning();
    if (state.tab === 'receipts') return renderReceipts();
    return renderDashboard();
  }

  function render() {
    const root = document.getElementById('department-section-root');
    if (!root) return;
    document.title = state.section.label + ' - Build The Show';
    root.innerHTML = renderHero() + renderTabs() + renderContent() + renderReceiptModal();
  }

  function currentCategoryId() {
    const cats = sectionCategories();
    return cats[0] ? cats[0].id : '';
  }

  function renderReceiptModal() {
    const receipt = state.editingReceiptId ? state.receipts.find(function (item) { return item.id === state.editingReceiptId; }) : null;
    return '<div class="dept-modal" id="dept-receipt-modal" onclick="BTSDepartmentSection.closeModalOnBackdrop(event)">' +
      '<div class="dept-modal-card" role="dialog" aria-modal="true" aria-labelledby="dept-receipt-title">' +
        '<div class="dept-modal-head"><div class="dept-modal-title" id="dept-receipt-title">' + (receipt ? 'Edit Receipt' : 'Add Receipt') + '</div><button type="button" class="dept-close" onclick="BTSDepartmentSection.closeReceiptModal()" aria-label="Close">x</button></div>' +
        '<div class="dept-modal-body"><div class="dept-form-grid">' +
          field('Submitted By', 'dept-rec-name', 'text', receipt ? receiptSubmitter(receipt) : '', '') +
          field('Email', 'dept-rec-email', 'email', receipt ? (receipt.submitted_by_email || '') : '', '') +
          field('Date', 'dept-rec-date', 'date', receipt ? (receipt.receipt_date || '') : '', '') +
          field('Vendor', 'dept-rec-vendor', 'text', receipt ? (receipt.vendor || '') : '', '') +
          field('Amount', 'dept-rec-amount', 'number', receipt ? ((receipt.amount_cents || 0) / 100).toFixed(2) : '', '0.00') +
          '<div class="dept-field"><label>Status</label><select id="dept-rec-status"><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></div>' +
          '<div class="dept-field full"><label>Description</label><textarea id="dept-rec-desc" placeholder="What was this for?">' + esc(receipt ? (receipt.description || '') : '') + '</textarea></div>' +
          '<div class="dept-field full"><label>Notes</label><textarea id="dept-rec-notes" placeholder="Any extra context">' + esc(receipt ? (receipt.notes || '') : '') + '</textarea></div>' +
        '</div></div>' +
        '<div class="dept-modal-foot"><button type="button" class="dept-action secondary" onclick="BTSDepartmentSection.closeReceiptModal()">Cancel</button><button type="button" class="dept-action" onclick="BTSDepartmentSection.saveReceipt()">Save Receipt</button></div>' +
      '</div>' +
    '</div>';
  }

  function field(label, id, type, value, placeholder) {
    return '<div class="dept-field"><label>' + esc(label) + '</label><input id="' + esc(id) + '" type="' + esc(type) + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" /></div>';
  }

  function hydrateReceiptModal() {
    const receipt = state.editingReceiptId ? state.receipts.find(function (item) { return item.id === state.editingReceiptId; }) : null;
    const status = document.getElementById('dept-rec-status');
    if (status) status.value = receipt ? (receipt.status || 'pending') : 'pending';
  }

  async function createCategory() {
    const payload = {
      production_id: state.prodId,
      name: state.section.label,
      type: 'expense',
      color: state.group.color,
      planned_cents: 0,
      sort_order: 900 + config().allSections().findIndex(function (item) { return item.key === state.section.key && item.group.key === state.group.key; }),
    };
    try {
      const response = await fetch(URL + '/rest/v1/budget_categories', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadData();
      render();
    } catch (error) {
      alert('Could not create category: ' + error.message);
    }
  }

  function openReceiptModal(id) {
    if (!currentCategoryId()) return;
    state.editingReceiptId = id || '';
    render();
    const modal = document.getElementById('dept-receipt-modal');
    if (modal) modal.classList.add('open');
    hydrateReceiptModal();
  }

  function closeReceiptModal() {
    state.editingReceiptId = '';
    const modal = document.getElementById('dept-receipt-modal');
    if (modal) modal.classList.remove('open');
  }

  function closeModalOnBackdrop(event) {
    if (event.target && event.target.id === 'dept-receipt-modal') closeReceiptModal();
  }

  async function saveReceipt() {
    const categoryId = currentCategoryId();
    if (!categoryId) return;
    const amount = Math.round((parseFloat(document.getElementById('dept-rec-amount').value) || 0) * 100);
    const status = document.getElementById('dept-rec-status').value || 'pending';
    const payload = {
      production_id: state.prodId,
      category_id: categoryId,
      submitted_by_name: document.getElementById('dept-rec-name').value.trim() || null,
      submitted_by_email: document.getElementById('dept-rec-email').value.trim() || null,
      receipt_date: document.getElementById('dept-rec-date').value || null,
      vendor: document.getElementById('dept-rec-vendor').value.trim() || null,
      amount_cents: amount,
      description: document.getElementById('dept-rec-desc').value.trim() || null,
      notes: document.getElementById('dept-rec-notes').value.trim() || null,
      status: status,
    };
    if (!payload.vendor && !payload.description) {
      alert('Add a vendor or description.');
      return;
    }
    try {
      const id = state.editingReceiptId;
      const response = await fetch(URL + '/rest/v1/budget_receipts' + (id ? '?id=eq.' + encodeURIComponent(id) : ''), {
        method: id ? 'PATCH' : 'POST',
        headers: headers(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      state.editingReceiptId = '';
      await loadData();
      render();
    } catch (error) {
      alert('Could not save receipt: ' + error.message);
    }
  }

  async function init() {
    const p = params();
    state.prodId = p.get('id') || '';
    const groupKey = p.get('group') || 'front-of-house';
    state.group = config().findGroup(groupKey);
    state.section = config().findSection(state.group.key, p.get('section') || '');
    state.tab = (config().tabs.some(function (tab) { return tab.key === p.get('tab'); }) ? p.get('tab') : 'dashboard');
    await loadData();
    render();
    setRoute(state.tab);
  }

  window.BTSDepartmentSection = {
    init,
    openTab: setRoute,
    createCategory,
    openReceiptModal,
    closeReceiptModal,
    closeModalOnBackdrop,
    saveReceipt,
  };
})();
