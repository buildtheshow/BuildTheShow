/* volunteer-roles.js — Volunteer Roster standalone module.
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

      function fmtDateShift(row) {
        if (row.shift_date) return S.fmtDate(row.shift_date);
        const rd = Array.isArray(row.required_dates) ? row.required_dates.filter(Boolean) : [];
        return rd.length ? rd.join(', ') : 'Flexible';
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

      function rowCardHtml(row) {
        const timeStr = fmtTime(row.shift_start_time) && fmtTime(row.shift_end_time)
          ? fmtTime(row.shift_start_time) + ' - ' + fmtTime(row.shift_end_time)
          : fmtTime(row.shift_start_time) || '';
        return `
          <div class="vol-role-card">
            <div class="vol-role-top">
              <div style="min-width:0;flex:1;">
                <div class="vol-role-title">${esc(row.name || 'Unknown')}</div>
                <div class="vol-role-meta">${esc(row.role_name || 'Volunteer')}${row.department ? ` &middot; ${esc(row.department)}` : ''} &middot; ${esc(fmtDateShift(row))}${timeStr ? ` &middot; ${esc(timeStr)}` : ''}</div>
                <div class="vol-role-meta">${row.email ? esc(row.email) : ''}${row.email && row.phone ? ' &middot; ' : ''}${row.phone ? esc(row.phone) : ''}</div>
              </div>
              <span class="${badgeClass(row.status || 'pending')}">${badgeLabel(row.status || 'pending')}</span>
            </div>
            <div class="vol-role-actions">
              <button class="btn-secondary" style="font-size:0.76rem;padding:0.34rem 0.72rem;" onclick="window.__volRoster.openEdit('${esc(row.id)}')">Edit</button>
              <button class="btn-secondary" style="font-size:0.76rem;padding:0.34rem 0.6rem;color:#b91c1c;border-color:rgba(200,40,40,0.22);" onclick="window.__volRoster.remove('${esc(row.id)}')" title="Remove">&#10005;</button>
            </div>
          </div>`;
      }

      function render() {
        const body = document.getElementById('vroles-body');
        if (!body) return;
        body.innerHTML = rows.length
          ? `<div class="vol-role-stack">${rows.map(rowCardHtml).join('')}</div>`
          : `<div class="vol-empty-dept">No volunteers on the roster yet. Add one with the button above, or wait for sign-ups to come in through Requests.</div>`;
      }

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

      window.__volRoster = {
        openCreate() {
          ensureModalMounted();
          editingId = null;
          fillModal(null);
          document.getElementById('vr-modal-title').textContent = 'Add Volunteer';
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
          if (!confirm('Remove this volunteer from the roster? This cannot be undone.')) return;
          const { error } = await sb.from('volunteer_signups').delete().eq('id', id);
          if (error) { alert('Could not remove: ' + error.message); return; }
          await load();
        },
      };

      await load();
    },
    destroy() { delete window.__volRoster; },
  };
})();
