/* volunteer-applicants.js — Volunteer Requests standalone module.
   Mirrors loadVolunteerRequests()/renderVolunteerRequests() in production-workspace.js:
   stats row, pending/approved/all tabs, department + sort filters, a person list, and
   a detail panel with per-shift approve/decline. Gated on 'vol:requests'.

   Scope note: the in-app Requests panel also supports group-signup split/combine,
   shift rescheduling, contact editing, and "respond with review email" flows (each
   backed by its own modal and email-template logic elsewhere in production-workspace.js).
   Those are left out of this standalone extraction to keep it a focused, safe page —
   approve/decline here writes straight to volunteer_signups the same way
   volReqQuickRespond() does (no email). Everything else (viewing requests, department
   scoping, approving/declining) is fully real and live. */
(function () {
  'use strict';

  window.VolunteerApplicantsModule = {
    async init(prodId, container) {
      const S = window.BTSVolShared;
      if (!prodId || !container) return;

      const session = S.getPortalSession();
      if (session && !S.hasMenuKey(session, 'vol:requests')) {
        container.innerHTML = S.accessDeniedHtml('Requests');
        return;
      }

      container.innerHTML = S.heroHtml('Requests', 'Role Requests', 'Review and respond to volunteers who have requested roles.') +
        '<div id="vreq-body">Loading requests...</div>';

      const sb = supabase.createClient(S.SB_URL, S.SB_ANON);
      const scopeDeptKey = S.scopeDeptKeyForSession(session);
      const scopeDeptLabel = scopeDeptKey ? (S.VOLUNTEER_DEPARTMENTS.find(d => d.key === scopeDeptKey) || {}).label : null;

      let requests = [];
      let filter = 'pending';
      let deptFilter = 'all';
      let sortBy = 'newest';
      let selectedKey = null;

      async function load() {
        try {
          const { data, error } = await sb.from('volunteer_signups').select('*').eq('production_id', prodId).order('created_at', { ascending: false });
          if (error) throw error;
          requests = data || [];
          if (scopeDeptLabel) requests = requests.filter(r => (r.department || '') === scopeDeptLabel);
        } catch (e) {
          console.warn('[BTS] loadVolunteerRequests:', e?.message);
          requests = [];
        }
        render();
      }

      function esc(s) { return S.esc(s); }
      function portalKey(req) { return req.portal_token || req.id || (req.email || req.volunteer_email || 'unknown').toLowerCase(); }
      function rowsForKey(key) {
        return requests.filter(row => {
          if (row.portal_token) return row.portal_token === key;
          if (row.id && row.id === key) return true;
          return (row.email || row.volunteer_email || '').toLowerCase() === key;
        });
      }
      function initials(name) {
        if (!name) return '?';
        return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
      }
      function timeAgo(dateStr) {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's') + ' ago';
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
        const days = Math.floor(hours / 24);
        if (days === 1) return 'Yesterday';
        if (days < 7) return days + ' days ago';
        return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
      }
      function badgeClass(status) {
        const map = { pending: 'pending', approved: 'approved', partially_filled: 'partial', declined: 'declined' };
        return 'vol-req-badge vol-req-badge--' + (map[status] || 'pending');
      }
      function badgeLabel(status) {
        const map = { pending: 'Pending', approved: 'Approved', partially_filled: 'Partially Filled', declined: 'Declined' };
        return map[status] || 'Pending';
      }
      function fmtTime(t) {
        if (!t) return '';
        const [h, m] = String(t).slice(0, 5).split(':').map(Number);
        const ap = h >= 12 ? 'pm' : 'am';
        return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
      }
      function dateLabel(req) {
        if (req.shift_date) {
          const d = new Date(req.shift_date + 'T12:00:00');
          return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
        }
        const rd = Array.isArray(req.required_dates) ? req.required_dates.filter(Boolean) : [];
        if (rd.length) return rd.join(' · ');
        return '';
      }
      function shiftHrs(s) {
        const stored = parseFloat(s.approved_hours);
        if (Number.isFinite(stored) && stored > 0) return stored;
        if (s.shift_start_time && s.shift_end_time) {
          const [sh, sm] = s.shift_start_time.slice(0, 5).split(':').map(Number);
          const [eh, em] = s.shift_end_time.slice(0, 5).split(':').map(Number);
          return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
        }
        return 0;
      }

      window.__volReqSetFilter = function (f) { filter = f; selectedKey = null; render(); };
      window.__volReqSetDept = function (d) { deptFilter = d; render(); };
      window.__volReqSetSort = function (s) { sortBy = s; render(); };
      window.__volReqSelect = function (key) { selectedKey = key; render(); };
      window.__volReqRespond = async function (ids, newStatus, btn) {
        if (!ids || !ids.length) return;
        const label = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
        try {
          if (newStatus === 'approved') {
            const rows = ids.map(id => requests.find(r => String(r.id) === String(id))).filter(Boolean);
            await Promise.all(rows.map(row => {
              const payload = { status: 'approved' };
              const hrs = shiftHrs(row);
              if (hrs > 0) payload.approved_hours = hrs;
              return sb.from('volunteer_signups').update(payload).eq('id', row.id);
            }));
          } else {
            await sb.from('volunteer_signups').update({ status: newStatus }).in('id', ids);
          }
          await load();
        } catch (e) {
          alert('Could not update: ' + (e.message || 'Unknown error'));
          if (btn) { btn.disabled = false; btn.textContent = label; }
        }
      };

      function detailHtml(key) {
        if (!key) return '<div class="vol-req-detail-empty"><div style="font-size:0.8rem;font-weight:700;">Select a person to review their shifts</div></div>';
        const shifts = rowsForKey(key);
        if (!shifts.length) return '<div class="vol-req-detail-empty"><div style="font-size:0.8rem;font-weight:700;">No shifts found</div></div>';
        const p = { name: shifts[0].name, email: shifts[0].email, phone: shifts[0].phone, notes: shifts[0].notes || shifts[0].message, created_at: shifts[0].created_at };
        const overallStatus = shifts.some(s => (s.status || 'pending') === 'pending') ? 'pending'
          : shifts.every(s => s.status === 'approved') ? 'approved'
          : shifts.every(s => s.status === 'declined') ? 'declined' : 'partially_filled';
        const pending = shifts.filter(s => (s.status || 'pending') === 'pending');
        window.__volReqPendingIds = pending.map(s => s.id);
        const totalHrs = shifts.reduce((sum, s) => sum + shiftHrs(s), 0);
        const approvedHrs = shifts.filter(s => s.status === 'approved').reduce((sum, s) => sum + shiftHrs(s), 0);

        const shiftRows = shifts.map(s => {
          const isPending = (s.status || 'pending') === 'pending';
          const startFmt = fmtTime(s.shift_start_time), endFmt = fmtTime(s.shift_end_time);
          const timeStr = startFmt && endFmt ? startFmt + ' - ' + endFmt : startFmt || '';
          const hrs = shiftHrs(s);
          return '<div class="vol-req-shift-row" style="border-left:3px solid #572e88;padding-left:0.75rem;padding-top:0.6rem;padding-bottom:0.6rem;">'
            + '<div style="flex:1;min-width:0;">'
            + '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.2rem;">'
            + '<div class="vol-req-shift-row-role" style="color:#572e88;font-size:0.88rem;font-weight:800;">' + esc(s.role_name || 'Volunteer') + '</div>'
            + '<span class="' + badgeClass(s.status || 'pending') + '">' + badgeLabel(s.status || 'pending') + '</span>'
            + '</div>'
            + '<div style="font-size:0.78rem;color:#000000;font-weight:700;margin-bottom:0.18rem;">' + esc(dateLabel(s) || 'Flexible') + (timeStr ? ' &middot; ' + esc(timeStr) : '') + (hrs > 0 ? ' <span style="color:#2d6e35;font-weight:800;">(' + hrs + ' hr' + (hrs === 1 ? '' : 's') + ')</span>' : '') + '</div>'
            + '<div style="font-size:0.72rem;color:#7a6a95;">' + esc(s.department || '') + '</div>'
            + '</div>'
            + '<div class="vol-req-shift-row-actions">'
            + (isPending
              ? '<button type="button" class="vol-req-shift-approve" onclick="window.__volReqRespond([\'' + esc(s.id) + '\'],\'approved\',this)"><span aria-hidden="true">&#10003;</span> Approve</button>'
              + '<button type="button" class="vol-req-shift-decline" onclick="window.__volReqRespond([\'' + esc(s.id) + '\'],\'declined\',this)"><span aria-hidden="true">&#10005;</span> Decline</button>'
              : '')
            + '</div></div>';
        }).join('');

        return '<div class="vol-req-detail-header">'
          + '<div class="vol-req-detail-id">'
          + '<div class="vol-req-detail-avatar">' + esc(initials(p.name)) + '</div>'
          + '<div><div class="vol-req-detail-name">' + esc(p.name || 'Unknown') + '</div>'
          + '<div class="vol-req-detail-role">' + esc(p.email || '') + '</div>'
          + (p.phone ? '<div class="vol-req-detail-time">' + esc(p.phone) + '</div>' : '')
          + '<div class="vol-req-detail-time">Requested ' + timeAgo(p.created_at) + '</div>'
          + '</div></div>'
          + '<span class="' + badgeClass(overallStatus) + '">' + badgeLabel(overallStatus) + '</span>'
          + '</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.85rem 1.5rem;border-bottom:1px solid rgba(87,46,136,0.08);background:#faf9fc;">'
          + '<div style="flex:1;min-width:120px;background:#fff;border:1px solid rgba(87,46,136,0.1);border-radius:8px;padding:0.6rem 0.75rem;">'
          + '<div style="font-size:0.62rem;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:rgba(87,46,136,0.45);margin-bottom:0.2rem;">Hours Requested</div>'
          + '<div style="font-size:1.05rem;font-weight:900;color:#000000;">' + (totalHrs > 0 ? totalHrs + ' hrs' : 'Flexible') + '</div></div>'
          + '<div style="flex:1;min-width:120px;background:#fff;border:1px solid rgba(87,46,136,0.1);border-radius:8px;padding:0.6rem 0.75rem;">'
          + '<div style="font-size:0.62rem;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:rgba(87,46,136,0.45);margin-bottom:0.2rem;">Hours Approved</div>'
          + '<div style="font-size:1.05rem;font-weight:900;color:' + (approvedHrs > 0 ? '#2d6e35' : '#000000') + ';">' + (approvedHrs > 0 ? approvedHrs + ' hrs' : '&mdash;') + '</div></div>'
          + '</div>'
          + (p.notes ? '<div class="vol-req-detail-section"><div class="vol-req-detail-section-title">From the Volunteer</div><div class="vol-req-quote">' + esc(p.notes) + '</div></div>' : '')
          + '<div class="vol-req-detail-section"><div class="vol-req-detail-section-title">Requested Shifts</div>' + shiftRows + '</div>'
          + (pending.length ? '<div style="display:flex;gap:0.75rem;padding:1rem 1.5rem;border-top:1px solid rgba(87,46,136,0.08);">'
            + '<button style="flex:1;padding:0.8rem 1rem;font-size:1rem;font-weight:800;border-radius:10px;border:none;background:#2d6e35;color:#fff;cursor:pointer;font-family:inherit;" onclick="window.__volReqRespond(window.__volReqPendingIds,\'approved\',this)">&#10003;&nbsp; Approve All</button>'
            + '<button style="flex:1;padding:0.8rem 1rem;font-size:1rem;font-weight:800;border-radius:10px;border:none;background:#b33a25;color:#fff;cursor:pointer;font-family:inherit;" onclick="window.__volReqRespond(window.__volReqPendingIds,\'declined\',this)">&#10005;&nbsp; Decline All</button>'
            + '</div>' : '');
      }

      function render() {
        const root = document.getElementById('vreq-body');
        if (!root) return;

        const pendingRows = requests.filter(r => (r.status || 'pending') === 'pending');
        const approvedRows = requests.filter(r => r.status === 'approved');
        const declinedRows = requests.filter(r => r.status === 'declined');
        const pendingPeople = new Set(pendingRows.map(portalKey)).size;
        const totalHours = requests.filter(r => r.status === 'approved' || r.status === 'partially_filled').reduce((sum, r) => sum + shiftHrs(r), 0);
        const counts = { all: requests.length, pending: pendingPeople, approved: approvedRows.length, declined: declinedRows.length };

        let filtered = filter === 'all' ? requests : filter === 'pending' ? pendingRows : filter === 'approved' ? approvedRows : declinedRows;
        const allDepts = [...new Set(requests.map(r => r.department || '').filter(Boolean))].sort();
        if (deptFilter !== 'all') filtered = filtered.filter(r => (r.department || '') === deptFilter);

        const personMap = new Map();
        filtered.forEach(req => {
          const key = portalKey(req);
          if (!personMap.has(key)) personMap.set(key, { key, name: req.name || 'Unknown', created_at: req.created_at, dept: req.department || '', shifts: [] });
          personMap.get(key).shifts.push(req);
        });
        let people = [...personMap.values()];
        if (sortBy === 'oldest') people.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        else if (sortBy === 'name') people.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else people.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

        const statsHtml = '<div class="vol-req-stats">'
          + '<div class="vol-req-stat-card vol-req-stat-card--pending"><div class="vol-req-stat-content"><div class="vol-req-stat-value">' + pendingPeople + ' Pending Requests</div><div class="vol-req-stat-desc">People still waiting for approval.</div></div></div>'
          + '<div class="vol-req-stat-card vol-req-stat-card--approved"><div class="vol-req-stat-content"><div class="vol-req-stat-value">' + approvedRows.length + ' Approved Total</div><div class="vol-req-stat-desc">Requests already confirmed.</div></div></div>'
          + '<div class="vol-req-stat-card vol-req-stat-card--hours"><div class="vol-req-stat-content"><div class="vol-req-stat-value">' + Math.round(totalHours) + ' Hours Approved</div><div class="vol-req-stat-desc">Approved volunteer time.</div></div></div>'
          + '</div>';

        const tabDefs = [{ key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }, { key: 'all', label: 'All' }];
        const tabInner = tabDefs.map(t => {
          const cnt = counts[t.key];
          const active = filter === t.key ? ' active' : '';
          const badge = cnt > 0 ? ' <span class="vol-req-tab-count">' + cnt + '</span>' : '';
          return '<button class="vol-req-tab' + active + '" onclick="window.__volReqSetFilter(\'' + t.key + '\')">' + esc(t.label) + badge + '</button>';
        }).join('');
        const deptOptions = '<option value="all">All Departments</option>' + allDepts.map(d => '<option value="' + esc(d) + '"' + (deptFilter === d ? ' selected' : '') + '>' + esc(d) + '</option>').join('');
        const sortOptions = [['newest', 'Newest First'], ['oldest', 'Oldest First'], ['name', 'A-Z by Name']].map(([v, l]) => '<option value="' + v + '"' + (sortBy === v ? ' selected' : '') + '>' + l + '</option>').join('');
        const tabsHtml = '<div class="vol-req-topbar">'
          + '<div class="vol-req-tabs">' + tabInner + '</div>'
          + '<div class="vol-req-filter-controls">'
          + (scopeDeptLabel ? '' : '<select class="vol-req-filter-select" onchange="window.__volReqSetDept(this.value)">' + deptOptions + '</select>')
          + '<select class="vol-req-filter-select" onchange="window.__volReqSetSort(this.value)">' + sortOptions + '</select>'
          + '</div></div>';

        const listItemsHtml = people.length === 0
          ? '<div class="vol-req-empty-list"><div>No requests in this category yet.</div></div>'
          : people.map(person => {
            const active = selectedKey === person.key ? ' active' : '';
            const statuses = person.shifts.map(s => s.status || 'pending');
            const status = statuses.some(s => s === 'pending') ? 'pending' : statuses.every(s => s === 'approved') ? 'approved' : statuses.every(s => s === 'declined') ? 'declined' : 'partially_filled';
            const roles = [...new Set(person.shifts.map(s => s.role_name).filter(Boolean))].join(', ');
            return '<div class="vol-req-item' + active + '" data-key="' + esc(person.key) + '" onclick="window.__volReqSelect(this.dataset.key)">'
              + '<div class="vol-req-item-avatar">' + esc(initials(person.name)) + '</div>'
              + '<div class="vol-req-item-body"><div class="vol-req-item-name">' + esc(person.name) + '</div>'
              + '<div class="vol-req-item-role">' + esc(roles || 'Volunteer') + '</div></div>'
              + '<span class="' + badgeClass(status) + '" style="flex-shrink:0;">' + badgeLabel(status) + '</span>'
              + '</div>';
          }).join('');

        root.innerHTML = statsHtml
          + '<div class="vol-req-panel-outer">'
          + tabsHtml
          + '<div class="vol-req-layout">'
          + '<div class="vol-req-list-panel"><div class="vol-req-list">' + listItemsHtml + '</div></div>'
          + '<div class="vol-req-detail-panel">' + detailHtml(selectedKey) + '</div>'
          + '</div></div>';
      }

      await load();
    },
    destroy() {
      delete window.__volReqSetFilter; delete window.__volReqSetDept; delete window.__volReqSetSort;
      delete window.__volReqSelect; delete window.__volReqRespond; delete window.__volReqPendingIds;
    },
  };
})();
