/* volunteer-roles.js: Volunteer Roster standalone module.
   Roles is the roster of actual volunteers: who they are, what role/date
   they're filling, and a place to edit or manually add them. Replaced the
   old "internal opportunity definitions" version of this page - the
   opportunity/publish workflow (Suggestions/Publish/Share pages) was
   removed entirely, so this now reads/writes volunteer_signups directly
   instead of the opportunities table. Gated on 'vol:roles'. */
(function () {
  'use strict';

  window.VolunteerRolesModule = {
    async init(prodId, container) {
      const S = window.BTSVolShared;
      if (!prodId || !container) return;

      const session = S.getPortalSession();
      if (session && !S.hasMenuKey(session, 'vol:roles')) {
        container.innerHTML = S.accessDeniedHtml('Roles');
        return;
      }

      container.innerHTML = S.heroHtml('Roles', 'Volunteer Roster', 'Everyone filling a volunteer role, what they are doing, and when. Edit their info or add someone directly.', prodId) +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:0.85rem;"><button type="button" class="btn-primary" onclick="window.__volRoster.openCreate()">+ Add Volunteer</button></div>' +
        '<div id="vroles-body">Loading roster...</div>';

      const sb = supabase.createClient(S.SB_URL, S.SB_ANON);
      const scopeDeptKey = S.scopeDeptKeyForSession(session);
      const scopeDeptLabel = scopeDeptKey ? (S.VOLUNTEER_DEPARTMENTS.find(d => d.key === scopeDeptKey) || {}).label : null;
      const esc = S.esc;

      let rows = [];

      async function load() {
        try {
          const { data, error } = await sb.from('volunteer_signups').select('*').eq('production_id', prodId).order('name');
          if (error) throw error;
          rows = data || [];
          if (scopeDeptLabel) rows = rows.filter(r => (r.department || '') === scopeDeptLabel);
        } catch (e) {
          console.warn('[BTS] volunteer roster load error:', e?.message);
          rows = [];
        }
        render();
      }

      function fmtTime(t) {
        if (!t) return '';
        const [h, m] = String(t).slice(0, 5).split(':').map(Number);
        const ap = h >= 12 ? 'pm' : 'am';
        return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
      }
      function badgeClass(status) {
        const map = { pending: 'opp-status-draft', approved: 'opp-status-published', declined: 'opp-status-closed' };
        return 'opp-status-badge ' + (map[status] || map.pending);
      }
      function badgeLabel(status) {
        const map = { pending: 'Pending', approved: 'Approved', declined: 'Declined' };
        return map[status] || 'Pending';
      }
      const CAL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      function calBadgeHtml(dateStr) {
        const parts = String(dateStr).split('-');
        const month = CAL_MONTHS[parseInt(parts[1], 10) - 1] || '';
        const day = parseInt(parts[2], 10);
        return `<div class="cal-badge"><div class="cal-badge-month">${month}</div><div class="cal-badge-day">${day || ''}</div></div>`;
      }

      // ── Group shifts into one card per person ──────────────────────────
      function personKey(row) {
        const email = String(row.email || '').trim().toLowerCase();
        if (email) return 'email:' + email;
        const name = String(row.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        return name ? 'name:' + name : 'row:' + row.id;
      }
      function groupRows() {
        const map = new Map();
        rows.forEach(row => {
          const key = personKey(row);
          if (!map.has(key)) map.set(key, { key, name: row.name || 'Unknown', email: row.email || '', phone: row.phone || '', shifts: [] });
          const g = map.get(key);
          if (!g.email && row.email) g.email = row.email;
          if (!g.phone && row.phone) g.phone = row.phone;
          if (String(row.name || '').length > String(g.name || '').length) g.name = row.name || g.name;
          g.shifts.push(row);
        });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
      }

      function shiftChipHtml(row) {
        const st = row.status || 'pending';
        const timeStr = fmtTime(row.shift_start_time) && fmtTime(row.shift_end_time)
          ? fmtTime(row.shift_start_time) + '-' + fmtTime(row.shift_end_time)
          : fmtTime(row.shift_start_time) || '';
        if (!row.shift_date) {
          const rd = Array.isArray(row.required_dates) ? row.required_dates.filter(Boolean) : [];
          const label = rd.length ? rd.length + ' dates' : 'Flexible';
          return `<div class="vol-shift-flex" onclick="window.__volRoster.openEdit('${esc(row.id)}')" title="${esc(row.role_name || '')}">${esc(label)}</div>`;
        }
        return `
          <div class="vol-shift-chip status-${esc(st)}">
            <div onclick="window.__volRoster.openEdit('${esc(row.id)}')" title="Edit this shift">${calBadgeHtml(row.shift_date)}</div>
            ${timeStr ? `<div class="vol-shift-time">${esc(timeStr)}</div>` : ''}
            ${row.role_name ? `<div class="vol-shift-role">${esc(row.role_name)}</div>` : ''}
            <button class="vol-shift-x" onclick="window.__volRoster.remove('${esc(row.id)}')" title="Remove this shift">&#10005;</button>
          </div>`;
      }

      function personCardHtml(group) {
        const roles = [...new Set(group.shifts.map(s => s.role_name || 'Volunteer'))].join(' &middot; ');
        const depts = [...new Set(group.shifts.map(s => s.department).filter(Boolean))].join(' &middot; ');
        const statusCounts = group.shifts.reduce((m, s) => { const st = s.status || 'pending'; m[st] = (m[st] || 0) + 1; return m; }, {});
        const statusKeys = Object.keys(statusCounts);
        const statusHtml = statusKeys.length === 1
          ? `<span class="${badgeClass(statusKeys[0])}">${badgeLabel(statusKeys[0])}</span>`
          : `<span class="${badgeClass('pending')}">${group.shifts.length} shifts, mixed status</span>`;
        const shiftsHtml = group.shifts.slice()
          .sort((a, b) => String(a.shift_date || '').localeCompare(String(b.shift_date || '')))
          .map(shiftChipHtml).join('');
        return `
          <div class="vol-person-card">
            <div class="vol-person-top">
              <div style="min-width:0;flex:1;">
                <div class="vol-person-name">${esc(group.name || 'Unknown')}</div>
                <div class="vol-role-meta">${esc(roles || 'Volunteer')}${depts ? ` &middot; ${esc(depts)}` : ''}</div>
                <div class="vol-role-meta">${group.email ? esc(group.email) : ''}${group.email && group.phone ? ' &middot; ' : ''}${group.phone ? esc(group.phone) : ''}</div>
              </div>
              <div class="vol-person-actions">${statusHtml}</div>
            </div>
            <div class="vol-shift-row">
              ${shiftsHtml}
              <button class="vol-shift-flex" onclick="window.__volRoster.addShift('${esc(group.key)}')" title="Add another shift for ${esc(group.name)}">+ Shift</button>
            </div>
            <div class="vol-role-actions">
              <button class="btn-secondary" style="font-size:0.76rem;padding:0.34rem 0.72rem;" onclick="window.__volRoster.openMerge('${esc(group.key)}')">Merge with...</button>
            </div>
          </div>`;
      }

      function render() {
        const body = document.getElementById('vroles-body');
        if (!body) return;
        const groups = groupRows();
        currentGroups = groups;
        body.innerHTML = groups.length
          ? `<div class="vol-role-stack">${groups.map(personCardHtml).join('')}</div>`
          : `<div class="vol-empty-dept">No volunteers on the roster yet. Add one with the button above, or wait for sign-ups to come in through Requests.</div>`;
      }
      let currentGroups = [];

      // ── Edit / add modal ──────────────────────────────────────────────
      const MODAL_ID = 'bts-vol-roster-modal';
      function ensureModalMounted() {
        if (document.getElementById(MODAL_ID)) return;
        const deptOptions = ['<option value="">No department</option>']
          .concat(S.VOLUNTEER_DEPARTMENTS.filter(d => d.key !== 'other').map(d => `<option value="${esc(d.label)}">${esc(d.label)}</option>`))
          .join('');
        const div = document.createElement('div');
        div.innerHTML = `
          <div class="modal-overlay" id="${MODAL_ID}">
            <div class="modal modal-wide">
              <div class="modal-header">
                <div class="modal-title" id="vr-modal-title">Add Volunteer</div>
                <button class="modal-close" type="button" aria-label="Close" onclick="window.__volRoster.closeModal()">&#10005;</button>
              </div>
              <div class="form-error-msg" id="vr-error"></div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Name</label>
                  <input class="form-input" id="vr-name" type="text" placeholder="Full name" />
                </div>
                <div class="form-group">
                  <label class="form-label">Department <span class="opt">(optional)</span></label>
                  <select class="form-select" id="vr-department">${deptOptions}</select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email <span class="opt">(optional)</span></label>
                  <input class="form-input" id="vr-email" type="email" placeholder="name@example.com" />
                </div>
                <div class="form-group">
                  <label class="form-label">Phone <span class="opt">(optional)</span></label>
                  <input class="form-input" id="vr-phone" type="text" placeholder="(250) 555-0123" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Role / Position</label>
                <input class="form-input" id="vr-role" type="text" placeholder="e.g. Front of House, Set Strike Crew" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date <span class="opt">(optional)</span></label>
                  <input class="form-input" id="vr-date" type="date" />
                </div>
                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select class="form-select" id="vr-status">
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Start time <span class="opt">(optional)</span></label>
                  <input class="form-input" id="vr-start" type="time" />
                </div>
                <div class="form-group">
                  <label class="form-label">End time <span class="opt">(optional)</span></label>
                  <input class="form-input" id="vr-end" type="time" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Notes <span class="opt">(optional)</span></label>
                <textarea class="form-textarea" id="vr-notes" rows="3"></textarea>
              </div>
              <button class="btn-primary" id="vr-save-btn" onclick="window.__volRoster.submit()" style="width:100%;justify-content:center;">Save</button>
            </div>
          </div>`;
        document.body.appendChild(div.firstElementChild);
      }

      let editingId = null;
      function fillModal(row) {
        document.getElementById('vr-error').classList.remove('visible');
        document.getElementById('vr-name').value = row?.name || '';
        document.getElementById('vr-department').value = row?.department || '';
        document.getElementById('vr-email').value = row?.email || '';
        document.getElementById('vr-phone').value = row?.phone || '';
        document.getElementById('vr-role').value = row?.role_name || '';
        document.getElementById('vr-date').value = row?.shift_date || '';
        document.getElementById('vr-status').value = row?.status || 'approved';
        document.getElementById('vr-start').value = row?.shift_start_time ? String(row.shift_start_time).slice(0, 5) : '';
        document.getElementById('vr-end').value = row?.shift_end_time ? String(row.shift_end_time).slice(0, 5) : '';
        document.getElementById('vr-notes').value = row?.notes || row?.message || '';
      }

      // ── Merge modal ──────────────────────────────────────────────────
      const MERGE_MODAL_ID = 'bts-vol-merge-modal';
      function ensureMergeModalMounted() {
        if (document.getElementById(MERGE_MODAL_ID)) return;
        const div = document.createElement('div');
        div.innerHTML = `
          <div class="modal-overlay" id="${MERGE_MODAL_ID}">
            <div class="modal">
              <div class="modal-header">
                <div class="modal-title">Merge with...</div>
                <button class="modal-close" type="button" aria-label="Close" onclick="window.__volRoster.closeMerge()">&#10005;</button>
              </div>
              <div class="vol-role-meta">Pick the volunteer this is actually the same person as. Every shift on this card will move onto that record.</div>
              <div class="vol-merge-list" id="vr-merge-list"></div>
            </div>
          </div>`;
        document.body.appendChild(div.firstElementChild);
      }
      let mergeSourceKey = null;

      window.__volRoster = {
        openCreate() {
          ensureModalMounted();
          editingId = null;
          fillModal(null);
          document.getElementById('vr-modal-title').textContent = 'Add Volunteer';
          document.getElementById(MODAL_ID).classList.add('open');
        },
        addShift(key) {
          ensureModalMounted();
          editingId = null;
          const g = currentGroups.find(x => x.key === key);
          fillModal(null);
          if (g) {
            document.getElementById('vr-name').value = g.name || '';
            document.getElementById('vr-email').value = g.email || '';
            document.getElementById('vr-phone').value = g.phone || '';
            const last = g.shifts[g.shifts.length - 1];
            if (last?.department) document.getElementById('vr-department').value = last.department;
            if (last?.role_name) document.getElementById('vr-role').value = last.role_name;
          }
          document.getElementById('vr-modal-title').textContent = 'Add Shift' + (g ? ' for ' + g.name : '');
          document.getElementById(MODAL_ID).classList.add('open');
        },
        openEdit(id) {
          ensureModalMounted();
          const row = rows.find(r => String(r.id) === String(id));
          editingId = id;
          fillModal(row);
          document.getElementById('vr-modal-title').textContent = 'Edit Volunteer';
          document.getElementById(MODAL_ID).classList.add('open');
        },
        closeModal() {
          const el = document.getElementById(MODAL_ID);
          if (el) el.classList.remove('open');
          editingId = null;
        },
        async submit() {
          const errEl = document.getElementById('vr-error');
          errEl.classList.remove('visible');
          const name = document.getElementById('vr-name').value.trim();
          const role = document.getElementById('vr-role').value.trim();
          if (!name) { errEl.textContent = 'Name is required.'; errEl.classList.add('visible'); return; }
          if (!role) { errEl.textContent = 'Role / position is required.'; errEl.classList.add('visible'); return; }
          const saveBtn = document.getElementById('vr-save-btn');
          saveBtn.disabled = true;
          const payload = {
            production_id: prodId,
            name,
            role_name: role,
            department: document.getElementById('vr-department').value || null,
            email: document.getElementById('vr-email').value.trim() || null,
            phone: document.getElementById('vr-phone').value.trim() || null,
            shift_date: document.getElementById('vr-date').value || null,
            shift_start_time: document.getElementById('vr-start').value || null,
            shift_end_time: document.getElementById('vr-end').value || null,
            status: document.getElementById('vr-status').value,
            notes: document.getElementById('vr-notes').value.trim() || null,
          };
          let error;
          try {
            if (editingId) {
              ({ error } = await sb.from('volunteer_signups').update(payload).eq('id', editingId));
            } else {
              ({ error } = await sb.from('volunteer_signups').insert(payload));
            }
          } catch (err) {
            error = err;
          } finally {
            saveBtn.disabled = false;
          }
          if (error) { errEl.textContent = error.message; errEl.classList.add('visible'); return; }
          window.__volRoster.closeModal();
          await load();
        },
        async remove(id) {
          if (!confirm('Remove this shift from the roster? This cannot be undone.')) return;
          const { error } = await sb.from('volunteer_signups').delete().eq('id', id);
          if (error) { alert('Could not remove: ' + error.message); return; }
          await load();
        },
        openMerge(key) {
          ensureMergeModalMounted();
          mergeSourceKey = key;
          const source = currentGroups.find(g => g.key === key);
          const others = currentGroups.filter(g => g.key !== key);
          const listEl = document.getElementById('vr-merge-list');
          listEl.innerHTML = others.length
            ? others.map(g => `<div class="vol-merge-option" onclick="window.__volRoster.confirmMerge('${esc(g.key)}')"><span>${esc(g.name)}${g.email ? ' &middot; ' + esc(g.email) : ''}</span><span>${g.shifts.length} shift${g.shifts.length === 1 ? '' : 's'}</span></div>`).join('')
            : `<div class="vol-empty-dept">No other volunteers on the roster to merge with.</div>`;
          document.getElementById(MERGE_MODAL_ID).classList.add('open');
        },
        closeMerge() {
          const el = document.getElementById(MERGE_MODAL_ID);
          if (el) el.classList.remove('open');
          mergeSourceKey = null;
        },
        async confirmMerge(targetKey) {
          const source = currentGroups.find(g => g.key === mergeSourceKey);
          const target = currentGroups.find(g => g.key === targetKey);
          if (!source || !target) return;
          if (!confirm(`Merge "${source.name}" into "${target.name}"? All of ${source.name}'s shifts will move onto ${target.name}'s record.`)) return;
          const ids = source.shifts.map(s => s.id);
          const payload = { name: target.name, email: target.email || null, phone: target.phone || null };
          const { error } = await sb.from('volunteer_signups').update(payload).in('id', ids);
          if (error) { alert('Could not merge: ' + error.message); return; }
          window.__volRoster.closeMerge();
          await load();
        },
      };

      await load();
    },
    destroy() { delete window.__volRoster; },
  };
})();
