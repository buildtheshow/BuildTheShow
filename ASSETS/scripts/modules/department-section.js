/* department-section.js - reusable production department section page */
(function () {
  'use strict';

  const SUPABASE_URL = window.SUPABASE_URL || 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  const KEY = window.SUPABASE_ANON_KEY || '';

  const state = {
    prodId: '',
    group: null,
    section: null,
    tab: 'dashboard',
    categories: [],
    receipts: [],
    opportunities: [],
    signups: [],
    events: [],
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

  function fmtTime(value) {
    if (!value) return '';
    const raw = String(value).includes('T') ? String(value).split('T')[1] : String(value);
    const parts = raw.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parts[1] || '00';
    if (!Number.isFinite(hour)) return '';
    return (hour % 12 || 12) + ':' + minute + ' ' + (hour < 12 ? 'AM' : 'PM');
  }

  function fmtEventDate(value) {
    if (!value) return 'Date TBC';
    return fmtDate(String(value).slice(0, 10));
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

  function sectionMatchesText() {
    const aliases = categoryAliases().map(norm);
    return function (value) {
      const text = norm(value);
      return aliases.some(function (alias) { return text === alias || text.includes(alias) || alias.includes(text); });
    };
  }

  function sectionOpportunities() {
    const matches = sectionMatchesText();
    return state.opportunities.filter(function (opp) {
      return matches(opp.volunteer_role) || matches(opp.production_title) || matches(opp.summary) || matches(opp.description);
    });
  }

  function sectionSignups(opportunities) {
    const ids = new Set((opportunities || sectionOpportunities()).map(function (opp) { return opp.id; }));
    return state.signups.filter(function (signup) {
      const status = norm(signup.status);
      return ids.has(signup.opportunity_id) && status !== 'declined' && status !== 'rejected' && status !== 'cancelled';
    });
  }

  function sectionEvents() {
    const matches = sectionMatchesText();
    const now = new Date().toISOString();
    return state.events
      .filter(function (event) {
        return String(event.start_time || '') >= now && (
          matches(event.title) ||
          matches(event.notes) ||
          matches(event.event_type)
        );
      })
      .sort(function (a, b) { return String(a.start_time || '').localeCompare(String(b.start_time || '')); });
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

  function percent(value, total) {
    if (!total || total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
  }

  async function fetchTable(table, extra) {
    if (!KEY || !state.prodId) return [];
    const response = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?production_id=eq.' + encodeURIComponent(state.prodId) + (extra || ''), { headers: headers() });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async function loadData() {
    const safe = function (promise) { return promise.catch(function () { return []; }); };
    const results = await Promise.all([
      safe(fetchTable('budget_categories', '&type=eq.expense&order=sort_order.asc,created_at.asc')),
      safe(fetchTable('budget_receipts', '&order=created_at.desc')),
      safe(fetchTable('opportunities', '&select=id,production_title,volunteer_role,volunteers_needed,status,summary,description,event_date,time_commitment,created_at,updated_at&opportunity_type=in.(volunteer,creative_team)&order=created_at.desc')),
      safe(fetchTable('volunteer_signups', '&select=id,opportunity_id,status,volunteer_name,email,created_at,updated_at&order=created_at.desc')),
      safe(fetchTable('production_events', '&select=id,title,event_type,start_time,end_time,venue,notes&order=start_time.asc')),
    ]);
    state.categories = results[0] || [];
    state.receipts = results[1] || [];
    state.opportunities = results[2] || [];
    state.signups = results[3] || [];
    state.events = results[4] || [];
  }

  function tabTitle() {
    if (state.tab === 'dashboard') return 'Dashboard';
    if (state.tab === 'planning') return 'Planning';
    if (state.tab === 'receipts') return 'Receipts';
    return 'Dashboard';
  }

  function renderHero() {
    const hierarchy = [
      '<span class="page-hierarchy-page">Production Departments</span>',
      '<span class="page-hierarchy-sep">-</span>',
      '<span class="page-hierarchy-sub">' + esc(state.group.label) + '</span>',
    ].join('');
    return '<div class="aud-visual-hero dept-hero" style="--dept-color:' + esc(state.group.color) + ';">' +
      '<div class="aud-visual-hero-content"><div>' +
        '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span><span class="page-hierarchy">' + hierarchy + '</span></div>' +
        '<h1 class="aud-visual-title">' + esc(state.section.label + ' ' + tabTitle()) + '</h1>' +
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
    const approved = receipts.filter(function (receipt) { return receipt.status === 'approved' || receipt.status === 'paid'; });
    const cats = sectionCategories();
    const allocated = cats.reduce(function (sum, cat) { return sum + (cat.planned_cents || 0); }, 0);
    const spent = approved.reduce(function (sum, receipt) { return sum + (receipt.amount_cents || 0); }, 0);
    const remaining = Math.max(0, allocated - spent);
    const opportunities = sectionOpportunities();
    const signups = sectionSignups(opportunities);
    const acceptedSignups = signups.filter(function (s) {
      const st = norm(s.status);
      return st === 'approved' || st === 'checked_in' || st === 'completed';
    });
    const needed = opportunities.reduce(function (sum, opp) { return sum + (parseInt(opp.volunteers_needed, 10) || 0); }, 0);
    const assigned = acceptedSignups.length;
    const open = Math.max(0, needed - assigned);
    return '<div class="dept-dashboard">' +
      '<div class="dept-overview-row">' +
        renderBudgetCard(allocated, spent, remaining) +
        renderVolunteersCard(assigned, open, needed, acceptedSignups) +
        renderNextUpCard() +
      '</div>' +
      '<div class="dept-detail-row">' +
        renderActivityCard(receipts, signups, opportunities) +
        renderNotesCard() +
      '</div>' +
      renderQuickActions() +
    '</div>';
  }

  function renderBudgetCard(allocated, spent, remaining) {
    const used = percent(spent, allocated);
    return '<section class="dept-dash-card">' +
      '<div class="dept-dash-card-head"><span class="dept-dash-icon">$</span><span>Budget</span></div>' +
      '<div class="dept-budget-stats">' +
        statBlock('Allocated', fmtMoney(allocated)) +
        statBlock('Spent', fmtMoney(spent)) +
        statBlock('Remaining', fmtMoney(remaining), 'accent') +
      '</div>' +
      progressBar(used, state.group.color) +
      '<div class="dept-progress-note">' + used + '% of budget used</div>' +
      '<button type="button" class="dept-card-link" onclick="BTSDepartmentSection.goBudget()">View Budget</button>' +
    '</section>';
  }

  var LEAD_KEYWORDS = /\b(lead|manager|director|designer|coordinator|head|supervisor|technician|captain)\b/i;

  function signupRole(s) {
    var linked = state.opportunities.find(function (o) { return o.id === s.opportunity_id; });
    return linked ? (linked.production_title || linked.volunteer_role || linked.summary || '') : (s.volunteer_role || s.department || '');
  }

  function renderVolunteersCard(assigned, open, needed, acceptedSignups) {
    var filled = percent(assigned, needed);
    var all = acceptedSignups || [];
    var leads = all.filter(function (s) { return LEAD_KEYWORDS.test(signupRole(s)); });
    var crew = all.filter(function (s) { return !LEAD_KEYWORDS.test(signupRole(s)); });

    function chip(s) {
      var name = s.name || s.volunteer_name || s.email || 'Volunteer';
      var role = signupRole(s);
      return '<div class="dept-vol-chip">' +
        '<span class="dept-vol-name">' + esc(name) + '</span>' +
        (role ? '<span class="dept-vol-role">' + esc(role) + '</span>' : '') +
      '</div>';
    }

    var headHtml = '';
    if (leads.length) {
      headHtml = '<div class="dept-vol-section">' +
        '<div class="dept-vol-section-label">Department Head</div>' +
        '<div class="dept-vol-roster">' + leads.map(chip).join('') + '</div>' +
      '</div>';
    } else {
      headHtml = '<div class="dept-vol-section">' +
        '<div class="dept-vol-section-label">Department Head</div>' +
        '<div class="dept-vol-empty">No lead assigned yet</div>' +
      '</div>';
    }

    var crewHtml = crew.length
      ? '<div class="dept-vol-section"><div class="dept-vol-section-label">Volunteers</div><div class="dept-vol-roster">' + crew.map(chip).join('') + '</div></div>'
      : '';

    return '<section class="dept-dash-card">' +
      '<div class="dept-dash-card-head"><span class="dept-dash-icon">+</span><span>Volunteers</span></div>' +
      '<div class="dept-budget-stats">' +
        statBlock('Assigned', String(assigned), 'accent') +
        statBlock('Open Positions', String(open), 'accent') +
        statBlock('Total Needed', String(needed), 'accent') +
      '</div>' +
      progressBar(filled, state.group.color) +
      '<div class="dept-progress-note">' + filled + '% of volunteer needs filled</div>' +
      headHtml +
      crewHtml +
      '<button type="button" class="dept-card-link" onclick="BTSDepartmentSection.goVolunteers()">Manage Volunteers</button>' +
    '</section>';
  }

  function renderNextUpCard() {
    const next = sectionEvents()[0];
    if (!next) {
      return '<section class="dept-dash-card">' +
        '<div class="dept-dash-card-head"><span class="dept-dash-icon">#</span><span>Next Up</span></div>' +
        '<div class="dept-next-empty">No upcoming ' + esc(state.section.label) + ' date is on the production calendar yet.</div>' +
        '<button type="button" class="dept-card-link" onclick="BTSDepartmentSection.goCalendar()">View Calendar</button>' +
      '</section>';
    }
    const date = String(next.start_time || '').slice(0, 10);
    const day = date ? new Date(date + 'T12:00:00') : null;
    const month = day ? day.toLocaleDateString('en-CA', { month: 'short' }).toUpperCase() : 'TBC';
    const dayNum = day ? String(day.getDate()) : '-';
    const weekday = day ? day.toLocaleDateString('en-CA', { weekday: 'short' }).toUpperCase() : '';
    return '<section class="dept-dash-card dept-next-card">' +
      '<div class="dept-dash-card-head"><span class="dept-dash-icon">#</span><span>Next Up</span></div>' +
      '<div class="dept-next-layout">' +
        '<div><div class="dept-next-title">' + esc(next.title || 'Upcoming Date') + '</div>' +
          '<div class="dept-next-line">Date: ' + esc(fmtEventDate(next.start_time)) + '</div>' +
          '<div class="dept-next-line">Time: ' + esc(fmtTime(next.start_time) || 'Time TBC') + '</div>' +
          '<div class="dept-next-line">Location: ' + esc(next.venue || 'Location TBC') + '</div></div>' +
        '<div class="dept-date-badge"><div>' + esc(month) + '</div><strong>' + esc(dayNum) + '</strong><span>' + esc(weekday) + '</span></div>' +
      '</div>' +
      '<button type="button" class="dept-card-link" onclick="BTSDepartmentSection.goCalendar()">View Calendar</button>' +
    '</section>';
  }

  function renderActivityCard(receipts, signups, opportunities) {
    const rows = [];
    receipts.slice(0, 5).forEach(function (receipt) {
      rows.push({
        initials: initials(receiptSubmitter(receipt)),
        color: '#ca7ea7',
        title: receiptSubmitter(receipt) + ' uploaded a receipt' + (receipt.vendor ? ' from ' + receipt.vendor : ''),
        time: receipt.created_at || receipt.receipt_date || '',
      });
    });
    signups.slice(0, 5).forEach(function (signup) {
      rows.push({
        initials: initials(signup.name || signup.volunteer_name || signup.email || 'Volunteer'),
        color: '#78bbd4',
        title: (signup.name || signup.volunteer_name || signup.email || 'Volunteer') + ' joined this section',
        time: signup.updated_at || signup.created_at || '',
      });
    });
    opportunities.slice(0, 5).forEach(function (opp) {
      rows.push({
        initials: initials(opp.production_title || 'Role'),
        color: state.group.color,
        title: (opp.production_title || 'Volunteer role') + ' role updated',
        time: opp.updated_at || opp.created_at || '',
      });
    });
    rows.sort(function (a, b) { return String(b.time || '').localeCompare(String(a.time || '')); });
    return '<section class="dept-dash-card dept-activity-card">' +
      '<div class="dept-section-head"><div class="dept-dash-card-head"><span class="dept-line-icon">~</span><span>Recent Activity</span></div><button type="button" class="dept-card-link inline" onclick="BTSDepartmentSection.openTab(\'receipts\')">View All</button></div>' +
      (rows.length ? '<div class="dept-activity-list">' + rows.slice(0, 5).map(activityRow).join('') + '</div>' : '<div class="dept-next-empty">No recent section activity yet.</div>') +
    '</section>';
  }

  function renderNotesCard() {
    const notes = state.section.notes || [];
    return '<section class="dept-dash-card dept-notes-card">' +
      '<div class="dept-section-head"><div class="dept-dash-card-head"><span class="dept-line-icon">[]</span><span>Department Notes</span></div><button type="button" class="dept-card-link inline" onclick="BTSDepartmentSection.openTab(\'planning\')">Edit Notes</button></div>' +
      '<ul class="dept-note-list">' + notes.map(function (note) { return '<li>' + esc(note) + '</li>'; }).join('') + '</ul>' +
    '</section>';
  }

  function renderQuickActions() {
    return '<section class="dept-dash-card dept-actions-card">' +
      '<div class="dept-dash-card-head"><span class="dept-line-icon">!</span><span>Quick Actions</span></div>' +
      '<div class="dept-action-grid">' +
        quickAction('Manage Volunteers', 'Add, remove, or assign volunteers', state.group.color, 'BTSDepartmentSection.goVolunteers()') +
        quickAction('View Budget', 'See budget details and spending', state.group.color, 'BTSDepartmentSection.goBudget()') +
        quickAction('Upload Receipt', 'Add a new receipt or expense', state.group.color, 'BTSDepartmentSection.openReceiptFromDashboard()') +
        quickAction('Department Files', 'View and manage files and documents', state.group.color, 'BTSDepartmentSection.goFiles()') +
      '</div>' +
    '</section>';
  }

  function statBlock(label, value, tone) {
    return '<div><div class="dept-stat-label">' + esc(label) + '</div><div class="dept-stat-value ' + esc(tone || '') + '">' + esc(value) + '</div></div>';
  }

  function progressBar(value, color) {
    return '<div class="dept-progress"><span style="width:' + esc(value) + '%;background:' + esc(color) + ';"></span></div>';
  }

  function initials(value) {
    const parts = String(value || 'BTS').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || 'B') + (parts[1]?.[0] || parts[0]?.[1] || 'T');
  }

  function activityRow(row) {
    return '<div class="dept-activity-row"><div class="dept-avatar" style="background:' + esc(row.color) + ';">' + esc(initials(row.initials)) + '</div><div><div class="dept-list-title">' + esc(row.title) + '</div><div class="dept-list-meta">' + esc(relativeTime(row.time)) + '</div></div></div>';
  }

  function relativeTime(value) {
    if (!value) return 'Recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fmtDate(String(value).slice(0, 10));
    const diff = Date.now() - date.getTime();
    const day = 24 * 60 * 60 * 1000;
    if (diff < day) return 'Today';
    if (diff < day * 2) return 'Yesterday';
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  function quickAction(title, copy, color, action) {
    return '<button type="button" class="dept-quick-action" onclick="' + esc(action) + '">' +
      '<span class="dept-quick-icon" style="background:' + esc(color) + ';"></span>' +
      '<span><strong>' + esc(title) + '</strong><small>' + esc(copy) + '</small></span>' +
      '<span class="dept-quick-arrow">&gt;</span>' +
    '</button>';
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
    root.style.setProperty('--dept-color', state.group.color || '#572e88');
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
      const response = await fetch(SUPABASE_URL + '/rest/v1/budget_categories', {
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

  function workspaceHref(tab, sub) {
    let url = 'production-workspace.html?id=' + encodeURIComponent(state.prodId || '');
    if (tab) url += '&tab=' + encodeURIComponent(tab);
    if (sub) url += '&sub=' + encodeURIComponent(sub);
    return url;
  }

  function pageHref(file) {
    return file + '?id=' + encodeURIComponent(state.prodId || '');
  }

  function goVolunteers() {
    location.href = workspaceHref('volunteers', 'roles');
  }

  function goBudget() {
    location.href = pageHref('budget-breakdown.html');
  }

  function goCalendar() {
    location.href = workspaceHref('calendar');
  }

  function goFiles() {
    location.href = pageHref('plan-files.html');
  }

  async function openReceiptFromDashboard() {
    if (!currentCategoryId()) {
      await createCategory();
    }
    openReceiptModal();
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
      const response = await fetch(SUPABASE_URL + '/rest/v1/budget_receipts' + (id ? '?id=eq.' + encodeURIComponent(id) : ''), {
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
    openReceiptFromDashboard,
    goVolunteers,
    goBudget,
    goCalendar,
    goFiles,
  };
})();
