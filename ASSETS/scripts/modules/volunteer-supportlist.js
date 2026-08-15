/* volunteer-supportlist.js — Production Support List module.
   A programme-ready Role / Name(s) list, like Cast List but for the
   production team, volunteers, and anyone else who needs a programme
   credit. Each row can mix names pulled live from Team/Volunteers with
   plain manual entries (for people not tracked anywhere else, like an
   outside print shop). */
(function () {
  'use strict';

  // Leadership roles always lead the list, in this exact order. Everything
  // else follows, grouped by department.
  const PRIORITY_ORDER = ['director', 'vocal director', 'musical director', 'producer'];

  // Department lead role names (same list the Volunteer staffing plan uses
  // for PLAN_ROLE_MAP.dept_leads) — within a department group, these sort
  // to the top ahead of their own crew.
  const LEAD_ROLE_NAMES = new Set([
    'stage manager', 'front of house manager', 'concession manager',
    'lighting designer / technician', 'lighting designer', 'lead builder',
    'lead set painter', 'lead prop person', 'costume designer',
    'marketing director', 'cast party coordinator',
  ]);

  window.VolunteerSupportListModule = {
    async init(prodId, container) {
      const S = window.BTSVolShared;
      if (!prodId || !container) return;

      const session = S.getPortalSession();
      if (session && !S.hasMenuKey(session, 'volunteers')) {
        container.innerHTML = S.accessDeniedHtml('Production Support List');
        return;
      }

      container.innerHTML = S.heroHtml('Production Support List', 'Production Support List', 'Everyone who supports the show off-stage, ready to paste into the programme.', prodId) +
        '<div id="spl-body">Loading...</div>';

      const sb = supabase.createClient(S.SB_URL, S.SB_ANON);
      const esc = S.esc;

      let rows = [];        // [{ id, label, entries: [{type,id,name}] }] — array order IS display order
      let teamMembers = []; // production_team_members
      let volunteers = [];  // volunteer_signups, status = approved
      let prodRow = null;
      let _view = 'programme'; // 'programme' | 'edit'
      let _reordering = false;

      function newId() { return 'spl-' + Date.now() + '-' + Math.floor(Math.random() * 1e6); }
      function normLabel(s) { return String(s || '').trim().toLowerCase(); }

      function resolveName(entry) {
        if (entry.type === 'team') {
          const m = teamMembers.find(t => String(t.id) === String(entry.id));
          return (m && m.name) || entry.name || 'Unknown';
        }
        if (entry.type === 'volunteer') {
          const v = volunteers.find(v => String(v.id) === String(entry.id));
          return (v && v.name) || entry.name || 'Unknown';
        }
        return entry.name || '';
      }

      // Team/Volunteer entries carry a real department, but plenty of rows
      // (Director, Costume Design, Programme Layout, anyone typed in
      // manually) aren't linked to a Team or Volunteer record at all, so
      // there's nothing for the system to look up. row.department is a
      // manual override that always wins when set, so every row can be
      // grouped correctly regardless of where its names came from.
      function rowDepartment(row) {
        if (row.department) return row.department;
        for (const e of row.entries) {
          if (e.type === 'team') {
            const m = teamMembers.find(t => String(t.id) === String(e.id));
            if (m && m.department) return m.department;
          }
          if (e.type === 'volunteer') {
            const v = volunteers.find(v => String(v.id) === String(e.id));
            if (v && v.department) return v.department;
          }
        }
        return '';
      }

      function knownDepartments() {
        const set = new Set();
        teamMembers.forEach(t => { if (t.department) set.add(t.department); });
        volunteers.forEach(v => { if (v.department) set.add(v.department); });
        rows.forEach(r => { if (r.department) set.add(r.department); });
        return [...set].sort();
      }

      // Default/auto-sort order: leadership roles first (Director, Vocal
      // Director, Musical Director, Producer, in that order), then everything
      // else grouped by department (rows with no known department last), and
      // within each department the lead role(s) sort ahead of their own crew.
      // Runs once automatically for a production that's never had a manual
      // order saved; also runnable on demand via the Auto-Sort button, which
      // resets whatever manual order was in place.
      function computeDefaultOrder() {
        return [...rows].sort((a, b) => {
          const ai = PRIORITY_ORDER.indexOf(normLabel(a.label));
          const bi = PRIORITY_ORDER.indexOf(normLabel(b.label));
          const aRank = ai === -1 ? PRIORITY_ORDER.length : ai;
          const bRank = bi === -1 ? PRIORITY_ORDER.length : bi;
          if (aRank !== bRank) return aRank - bRank;
          if (aRank < PRIORITY_ORDER.length) return 0;
          const aDept = rowDepartment(a), bDept = rowDepartment(b);
          if (!!aDept !== !!bDept) return aDept ? -1 : 1;
          if (aDept !== bDept) return aDept.localeCompare(bDept);
          const aLead = LEAD_ROLE_NAMES.has(normLabel(a.label));
          const bLead = LEAD_ROLE_NAMES.has(normLabel(b.label));
          if (aLead !== bLead) return aLead ? -1 : 1;
          return 0;
        });
      }

      // Removes duplicate names within a row (same resolved display name,
      // case-insensitive). Returns true if anything changed.
      function dedupeRows() {
        let changed = false;
        rows.forEach(row => {
          const seen = new Set();
          const kept = [];
          row.entries.forEach(e => {
            const key = normLabel(resolveName(e));
            if (key && seen.has(key)) { changed = true; return; }
            if (key) seen.add(key);
            kept.push(e);
          });
          row.entries = kept;
        });
        return changed;
      }

      function rowHasName(row, name) {
        const key = normLabel(name);
        return row.entries.some(e => normLabel(resolveName(e)) === key);
      }

      // Groups current Team members (by role) and approved Volunteers (by
      // role_name) into rows, adding anyone not already listed by name.
      // Non-destructive — never removes or overwrites a row someone edited
      // by hand.
      function syncFromTeamAndVolunteers() {
        let added = 0;
        function ensureRow(label, department) {
          let row = rows.find(r => normLabel(r.label) === normLabel(label));
          if (!row) { row = { id: newId(), label: label, entries: [], department: department || '' }; rows.push(row); }
          else if (!row.department && department) { row.department = department; }
          return row;
        }
        teamMembers.forEach(t => {
          if (!t.role) return;
          const row = ensureRow(t.role, t.department);
          if (!rowHasName(row, t.name)) { row.entries.push({ type: 'team', id: t.id, name: t.name }); added++; }
        });
        volunteers.forEach(v => {
          if (!v.role_name) return;
          const row = ensureRow(v.role_name, v.department);
          if (!rowHasName(row, v.name)) { row.entries.push({ type: 'volunteer', id: v.id, name: v.name }); added++; }
        });
        return added;
      }

      // One-time cleanup: merges rows previously split into
      // "<Role> — Rehearsal" / "<Role> — Performance" back into a single
      // "<Role>" row, combining their entries (deduped by name).
      function mergeRehearsalPerformanceSplits() {
        let changed = false;
        const emptiedIds = new Set();
        rows.forEach(row => {
          const m = row.label.match(/^(.*) — (Rehearsal|Performance)$/);
          if (!m) return;
          const baseLabel = m[1];
          let target = rows.find(r => r.id !== row.id && normLabel(r.label) === normLabel(baseLabel));
          if (!target) {
            row.label = baseLabel;
            changed = true;
            return;
          }
          row.entries.forEach(e => { if (!rowHasName(target, resolveName(e))) target.entries.push(e); });
          emptiedIds.add(row.id);
          changed = true;
        });
        if (emptiedIds.size) rows = rows.filter(r => !emptiedIds.has(r.id));
        return changed;
      }

      async function fetchTeamAndVolunteers() {
        const [teamRes, volRes] = await Promise.all([
          sb.from('production_team_members').select('id,name,role,department').eq('production_id', prodId).eq('is_active', true).order('name'),
          sb.from('volunteer_signups').select('id,name,role_name,department').eq('production_id', prodId).eq('status', 'approved').order('name'),
        ]);
        teamMembers = teamRes.data || [];
        volunteers = volRes.data || [];
      }

      async function load() {
        try {
          const [prodRes] = await Promise.all([
            sb.from('productions').select('production_support_list, production_support_ordered').eq('id', prodId).single(),
            fetchTeamAndVolunteers(),
          ]);
          prodRow = prodRes.data || {};
          rows = Array.isArray(prodRow.production_support_list) ? prodRow.production_support_list : [];
        } catch (e) {
          console.warn('[BTS] support list load error:', e?.message);
          rows = []; teamMembers = []; volunteers = [];
        }
        let needsSave = false;
        // Auto-fill from Team/Volunteers on every load, not just the first —
        // newly approved volunteers or newly added team members should show
        // up here without needing a manual Sync click. Still non-destructive:
        // this only ever adds a missing name, never removes or edits one.
        if (teamMembers.length || volunteers.length) {
          if (syncFromTeamAndVolunteers() > 0) needsSave = true;
        }
        if (mergeRehearsalPerformanceSplits()) needsSave = true;
        if (dedupeRows()) needsSave = true;
        // Backfill row.department from linked Team/Volunteer entries for
        // rows saved before departments lived on the row itself, so it's
        // no longer re-derived from entries every time — it's real data.
        rows.forEach(row => {
          if (row.department === undefined) row.department = '';
          if (!row.department) {
            const found = rowDepartment(row);
            if (found) { row.department = found; needsSave = true; }
          }
        });
        // One-time migration into manual ordering — materialize the sensible
        // starting order into storage, then never auto-sort again.
        if (!prodRow.production_support_ordered) {
          rows = computeDefaultOrder();
          prodRow.production_support_ordered = true;
          needsSave = true;
        }
        if (needsSave) saveRows();
        render();
      }

      async function saveRows() {
        window.AutoSave?.showSaving?.();
        const { error } = await sb.from('productions').update({
          production_support_list: rows,
          production_support_ordered: true,
        }).eq('id', prodId);
        if (error) { console.warn('[BTS] support list save error:', error.message); return; }
        window.AutoSave?.showSaved?.();
      }

      // ── Editor ───────────────────────────────────────────────────────
      function editorRowHtml(row) {
        const chips = row.entries.map((entry, i) => `<span class="spl-chip">${esc(resolveName(entry))}<button type="button" class="spl-chip-x" onclick="VolunteerSupportListModule.removeName('${row.id}',${i})" title="Remove">&times;</button></span>`).join('');
        const dragHandle = _reordering
          ? `<span class="spl-drag-handle" data-drag-handle title="Drag to reorder">&#9776;</span>`
          : '';
        return `<div class="spl-row${_reordering ? ' is-reordering' : ''}" data-row="${row.id}">
          ${dragHandle}
          <div class="spl-label-col">
            <input class="spl-label-input" value="${esc(row.label)}" placeholder="Role label, e.g. Stage Manager" onchange="VolunteerSupportListModule.setLabel('${row.id}',this.value)" />
            <input class="spl-dept-input" value="${esc(row.department || '')}" placeholder="Department (e.g. Front of House)" list="spl-dept-options" onchange="VolunteerSupportListModule.setDepartment('${row.id}',this.value)" />
          </div>
          <div class="spl-chips">${chips}<button type="button" class="spl-add-name-btn" onclick="VolunteerSupportListModule.openAddName('${row.id}')">+ Add Name</button></div>
          <button type="button" class="spl-remove-row-btn" onclick="VolunteerSupportListModule.removeRow('${row.id}')" title="Remove this role">&times;</button>
        </div>`;
      }

      // Only shown in Reorder mode, between every pair of rows — lets Katie
      // manually mark where the printed programme should leave a blank-space
      // break, instead of that being auto-computed from department text.
      function gapToggleHtml(row) {
        const on = !!row.gapAfter;
        return `<button type="button" class="spl-gap-toggle${on ? ' is-on' : ''}" onclick="VolunteerSupportListModule.toggleGapAfter('${row.id}')">${on ? '&#10005; Remove gap' : '+ Add gap here'}</button>`;
      }

      // Pointer-based drag reorder (not native HTML5 drag-and-drop, which is
      // unreliable once the list is rebuilt via innerHTML on every render).
      // Bound imperatively after each render, only while Reorder mode is on.
      function bindRowDragHandles() {
        if (!_reordering) return;
        document.querySelectorAll('#spl-body .spl-drag-handle').forEach(handle => {
          handle.addEventListener('pointerdown', e => {
            e.preventDefault();
            const rowEl = handle.closest('.spl-row');
            const rowId = rowEl?.dataset.row;
            if (!rowId) return;
            document.body.classList.add('spl-drag-active');
            rowEl.classList.add('spl-drag-source');

            const onMove = ev => {
              const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.spl-row');
              document.querySelectorAll('.spl-row.spl-drag-target').forEach(r => r.classList.remove('spl-drag-target'));
              if (under && under.dataset.row !== rowId) under.classList.add('spl-drag-target');
            };
            const onUp = ev => {
              document.removeEventListener('pointermove', onMove);
              document.removeEventListener('pointerup', onUp);
              document.body.classList.remove('spl-drag-active');
              const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.spl-row');
              document.querySelectorAll('.spl-row.spl-drag-target, .spl-row.spl-drag-source').forEach(r => r.classList.remove('spl-drag-target', 'spl-drag-source'));
              const targetId = under?.dataset.row;
              if (targetId && targetId !== rowId) {
                const fromIdx = rows.findIndex(r => r.id === rowId);
                const toIdx = rows.findIndex(r => r.id === targetId);
                if (fromIdx !== -1 && toIdx !== -1) {
                  const [moved] = rows.splice(fromIdx, 1);
                  rows.splice(toIdx, 0, moved);
                  render();
                  saveRows();
                }
              }
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
          });
        });
      }

      function editorHtml() {
        const options = `<datalist id="spl-dept-options">${knownDepartments().map(d => `<option value="${esc(d)}"></option>`).join('')}</datalist>`;
        if (!rows.length) {
          return options + `<div class="vol-empty-dept">No roles added yet. Add your first one below (Producer, Stage Manager, whatever your programme needs).</div>`;
        }
        const body = rows.map((row, i) => editorRowHtml(row) + (_reordering && i < rows.length - 1 ? gapToggleHtml(row) : '')).join('');
        return options + `<div class="spl-editor${_reordering ? ' is-reordering' : ''}">${body}</div>`;
      }

      // ── Programme preview (matches Katie's real printed programme:
      // right-aligned bold role / left-aligned name, names comma-separated
      // and wrapping naturally rather than one per line). Blank-space gaps
      // between clusters are entirely manual — set per row via the gap
      // toggle in Reorder mode — not auto-computed from department text,
      // since two rows meaning the same department don't always agree on
      // the exact wording.
      function programmeRowHtml(r, gapBefore) {
        return `<tr${gapBefore ? ' class="spl-gap-before"' : ''}>
            <td class="spl-role">${esc(r.label || '')}</td>
            <td>${r.entries.length ? esc(r.entries.map(e => resolveName(e)).join(', ')) : '<span class="spl-open">TBD</span>'}</td>
          </tr>`;
      }

      function programmeHtml() {
        if (!rows.length) return '';
        const list = rows.filter(r => r.label || r.entries.length);
        const trs = list.map((r, i) => {
          const prev = list[i - 1];
          const gapBefore = i > 0 && !!prev?.gapAfter;
          return programmeRowHtml(r, gapBefore);
        }).join('');
        return `<div class="spl-programme-card">
          <div class="spl-programme-title">Production Support</div>
          <table class="spl-table"><tbody>${trs}</tbody></table>
        </div>`;
      }

      function render() {
        const body = document.getElementById('spl-body');
        if (!body) return;
        body.innerHTML = `
          <div class="view-toggle">
            <button type="button" class="view-btn${_view === 'programme' ? ' active' : ''}" onclick="VolunteerSupportListModule.switchView('programme',this)">Programme</button>
            <button type="button" class="view-btn${_view === 'edit' ? ' active' : ''}" onclick="VolunteerSupportListModule.switchView('edit',this)">Edit</button>
          </div>
          <div class="spl-toolbar">
            ${_view === 'edit' ? `
              <button type="button" class="btn-secondary" onclick="VolunteerSupportListModule.addRow()">+ Add Role</button>
              <button type="button" class="btn-secondary" onclick="VolunteerSupportListModule.syncNow()">Sync Team &amp; Volunteers</button>
              <button type="button" class="btn-secondary" onclick="VolunteerSupportListModule.autoSort()" title="Leadership first, then grouped by department with leads on top">Auto-Sort</button>
              <button type="button" class="btn-secondary spl-reorder-toggle${_reordering ? ' is-active' : ''}" onclick="VolunteerSupportListModule.toggleReorder()">${_reordering ? 'Done Reordering' : 'Reorder'}</button>
            ` : ''}
            <div style="flex:1;"></div>
            <button type="button" class="btn-secondary" onclick="VolunteerSupportListModule.exportCSV()">Export CSV</button>
            <button type="button" class="btn-primary" onclick="VolunteerSupportListModule.exportPDF()">Export PDF</button>
          </div>
          ${_view === 'edit'
            ? `<div class="spl-col">${editorHtml()}</div>`
            : `<div class="spl-col">${programmeHtml() || '<div class="vol-empty-dept">Add a role to see the preview.</div>'}</div>`}
          <div class="modal-overlay" id="spl-add-name-modal">
            <div class="modal">
              <div class="modal-header">
                <div class="modal-title">Add a name</div>
                <button class="modal-close" type="button" aria-label="Close" onclick="VolunteerSupportListModule.closeAddName()">&#10005;</button>
              </div>
              <div class="form-group">
                <label class="form-label">From Team or Volunteers</label>
                <select class="form-select" id="spl-picker-select">
                  <option value="">Choose someone...</option>
                  ${teamMembers.length ? '<optgroup label="Team">' + teamMembers.map(t => `<option value="team:${t.id}">${esc(t.name)}${t.role ? ' — ' + esc(t.role) : ''}</option>`).join('') + '</optgroup>' : ''}
                  ${volunteers.length ? '<optgroup label="Volunteers">' + volunteers.map(v => `<option value="volunteer:${v.id}">${esc(v.name)}${v.role_name ? ' — ' + esc(v.role_name) : ''}</option>`).join('') + '</optgroup>' : ''}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Or type a name <span class="opt">(for anyone not tracked elsewhere)</span></label>
                <input class="form-input" type="text" id="spl-picker-manual" placeholder="e.g. Terry Penney (Courtenay Little Theatre)" />
              </div>
              <div class="form-error-msg" id="spl-picker-error"></div>
              <button class="btn-primary" style="width:100%;justify-content:center;" onclick="VolunteerSupportListModule.confirmAddName()">Add</button>
            </div>
          </div>
        `;
        bindRowDragHandles();
      }

      let _addNameRowId = null;

      window.VolunteerSupportListModule.switchView = function (v, btn) {
        _view = v;
        _reordering = false;
        document.querySelectorAll('#spl-body .view-btn').forEach(b => b.classList.remove('active'));
        btn?.classList.add('active');
        render();
      };
      window.VolunteerSupportListModule.toggleReorder = function () {
        _reordering = !_reordering;
        render();
      };
      window.VolunteerSupportListModule.toggleGapAfter = function (rowId) {
        const row = rows.find(r => r.id === rowId);
        if (!row) return;
        row.gapAfter = !row.gapAfter;
        render();
        saveRows();
      };
      window.VolunteerSupportListModule.autoSort = function () {
        if (!confirm('This resets the list to leadership-first, grouped by department with leads on top. Any manual reordering will be lost. Continue?')) return;
        rows = computeDefaultOrder();
        render();
        saveRows();
      };
      window.VolunteerSupportListModule.addRow = function () {
        const row = { id: newId(), label: '', entries: [], department: '' };
        rows.push(row);
        render();
        saveRows();
        // A blank new row has no department yet, so the leadership-first /
        // department sort can push it well down the list — scroll to it and
        // focus the label field so it doesn't look like the click did nothing.
        requestAnimationFrame(() => {
          const el = document.querySelector('.spl-row[data-row="' + row.id + '"]');
          if (!el) return;
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.querySelector('.spl-label-input')?.focus();
        });
      };
      window.VolunteerSupportListModule.syncNow = async function () {
        await fetchTeamAndVolunteers();
        const added = syncFromTeamAndVolunteers();
        dedupeRows();
        render();
        saveRows();
        alert(added ? `Added ${added} name${added === 1 ? '' : 's'} from Team & Volunteers.` : 'Already up to date — nothing new to add.');
      };
      window.VolunteerSupportListModule.removeRow = function (rowId) {
        if (!confirm('Remove this role from the list?')) return;
        rows = rows.filter(r => r.id !== rowId);
        render();
        saveRows();
      };
      window.VolunteerSupportListModule.setLabel = function (rowId, value) {
        const row = rows.find(r => r.id === rowId);
        if (!row) return;
        row.label = value;
        saveRows();
      };
      window.VolunteerSupportListModule.setDepartment = function (rowId, value) {
        const row = rows.find(r => r.id === rowId);
        if (!row) return;
        row.department = value.trim();
        saveRows();
      };
      window.VolunteerSupportListModule.removeName = function (rowId, idx) {
        const row = rows.find(r => r.id === rowId);
        if (!row) return;
        row.entries.splice(idx, 1);
        render();
        saveRows();
      };
      window.VolunteerSupportListModule.openAddName = function (rowId) {
        _addNameRowId = rowId;
        const modal = document.getElementById('spl-add-name-modal');
        if (modal) {
          document.getElementById('spl-picker-error').textContent = '';
          document.getElementById('spl-picker-manual').value = '';
          document.getElementById('spl-picker-select').value = '';
          modal.classList.add('open');
        }
      };
      window.VolunteerSupportListModule.closeAddName = function () {
        _addNameRowId = null;
        document.getElementById('spl-add-name-modal')?.classList.remove('open');
      };
      window.VolunteerSupportListModule.confirmAddName = function () {
        const row = rows.find(r => r.id === _addNameRowId);
        if (!row) return;
        const selectVal = document.getElementById('spl-picker-select').value;
        const manualVal = document.getElementById('spl-picker-manual').value.trim();
        let name = '';
        let entry = null;
        if (selectVal) {
          const [type, id] = selectVal.split(':');
          const source = type === 'team' ? teamMembers : volunteers;
          const match = source.find(x => String(x.id) === id);
          name = match ? match.name : '';
          entry = { type, id, name };
        } else if (manualVal) {
          name = manualVal;
          entry = { type: 'manual', name: manualVal };
        } else {
          document.getElementById('spl-picker-error').textContent = 'Pick someone from the list or type a name.';
          document.getElementById('spl-picker-error').classList.add('visible');
          return;
        }
        if (rowHasName(row, name)) {
          document.getElementById('spl-picker-error').textContent = name + ' is already on this role.';
          document.getElementById('spl-picker-error').classList.add('visible');
          return;
        }
        row.entries.push(entry);
        window.VolunteerSupportListModule.closeAddName();
        render();
        saveRows();
      };

      // ── Exports ─────────────────────────────────────────────────────
      window.VolunteerSupportListModule.exportCSV = function () {
        const csvRows = rows.map(r => [r.label || '', r.entries.map(e => resolveName(e)).join('; ')]);
        const csv = csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'production-support-list.csv';
        a.click();
      };

      window.VolunteerSupportListModule.exportPDF = function () {
        const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDFCtor) { alert('PDF export isn\'t ready yet — please wait a moment and try again.'); return; }
        // Matches Katie's printed programme convention: role right-aligned,
        // names comma-separated and wrapping naturally (not one per line),
        // with a blank gap wherever the row before it has gapAfter set
        // (manual, via the gap toggle in Reorder mode — not auto-computed).
        const list = rows.filter(r => r.label || r.entries.length);
        const items = list.map((r, i) => ({
          role: r.label || '',
          namesText: r.entries.length ? r.entries.map(e => resolveName(e)).join(', ') : 'TBD',
          gapBefore: i > 0 && !!list[i - 1]?.gapAfter,
        }));

        const doc = new jsPDFCtor({ unit: 'in', format: 'letter', orientation: 'portrait' });
        const pageW = 8.5, marginIn = 0.6, midX = pageW / 2, headerH = 0.45, gutterIn = 0.22;
        const usableH = 11 - marginIn * 2 - headerH;
        const nameColW = pageW - marginIn - midX - gutterIn;
        const lineHIn = pt => (pt / 72) * 1.35;
        const padIn = pt => (pt / 72) * 0.45;
        const gapIn = pt => (pt / 72) * 1.1;

        function layout(fontPt) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontPt);
          const pad = padIn(fontPt), lineH = lineHIn(fontPt), gap = gapIn(fontPt);
          let h = 0;
          const lined = items.map(item => {
            const lines = doc.splitTextToSize(item.namesText, nameColW);
            h += (item.gapBefore ? gap : 0) + Math.max(1, lines.length) * lineH + pad * 2;
            return { ...item, lines };
          });
          return { lined, h, pad, lineH, gap };
        }

        let fontPt = 12;
        const trial = layout(fontPt);
        const ratio = Math.min(2, Math.max(0.4, usableH / trial.h));
        fontPt = fontPt * ratio;
        const { lined, pad, lineH, gap } = layout(fontPt);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text('Production Support', midX, marginIn + 0.25, { align: 'center' });

        let y = marginIn + headerH;
        lined.forEach(item => {
          if (item.gapBefore) y += gap;
          y += pad;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(fontPt);
          doc.setTextColor(0, 0, 0);
          doc.text(item.role, midX - gutterIn, y + lineH * 0.72, { align: 'right', maxWidth: midX - marginIn - gutterIn });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(34);
          item.lines.forEach((line, i) => {
            doc.text(line, midX + gutterIn, y + lineH * 0.72 + i * lineH, { align: 'left' });
          });
          y += Math.max(1, item.lines.length) * lineH + pad;
        });

        doc.save('Production Support List - ' + new Date().toISOString().slice(0, 10) + '.pdf');
      };

      await load();
    },
    destroy() { delete window.VolunteerSupportListModule; },
  };
})();
