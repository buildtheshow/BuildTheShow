/* volunteer-supportlist.js — Production Support List module.
   A programme-ready Role / Name(s) list, like Cast List but for the
   production team, volunteers, and anyone else who needs a programme
   credit. Each row can mix names pulled live from Team/Volunteers with
   plain manual entries (for people not tracked anywhere else, like an
   outside print shop). */
(function () {
  'use strict';

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

      let rows = [];        // [{ id, label, entries: [{type,id,name}] }]
      let teamMembers = []; // production_team_members
      let volunteers = [];  // volunteer_signups, status = approved
      let prodRow = null;

      function newId() { return 'spl-' + Date.now() + '-' + Math.floor(Math.random() * 1e6); }
      function normLabel(s) { return String(s || '').trim().toLowerCase(); }

      // Groups current Team members (by role) and approved Volunteers (by
      // role_name) into rows, adding anyone not already listed. Non-destructive
      // — never removes or overwrites a row someone edited by hand.
      function syncFromTeamAndVolunteers() {
        let added = 0;
        function ensureRow(label) {
          let row = rows.find(r => normLabel(r.label) === normLabel(label));
          if (!row) { row = { id: newId(), label: label, entries: [] }; rows.push(row); }
          return row;
        }
        function hasEntry(row, type, id) {
          return row.entries.some(e => e.type === type && String(e.id) === String(id));
        }
        teamMembers.forEach(t => {
          if (!t.role) return;
          const row = ensureRow(t.role);
          if (!hasEntry(row, 'team', t.id)) { row.entries.push({ type: 'team', id: t.id, name: t.name }); added++; }
        });
        volunteers.forEach(v => {
          if (!v.role_name) return;
          const row = ensureRow(v.role_name);
          if (!hasEntry(row, 'volunteer', v.id)) { row.entries.push({ type: 'volunteer', id: v.id, name: v.name }); added++; }
        });
        return added;
      }

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
            sb.from('productions').select('production_support_list').eq('id', prodId).single(),
            fetchTeamAndVolunteers(),
          ]);
          prodRow = prodRes.data || {};
          rows = Array.isArray(prodRow.production_support_list) ? prodRow.production_support_list : [];
        } catch (e) {
          console.warn('[BTS] support list load error:', e?.message);
          rows = []; teamMembers = []; volunteers = [];
        }
        // First time this page has ever been opened for this production —
        // auto-fill from whoever's already on Team/Volunteers instead of
        // starting blank.
        if (!rows.length && (teamMembers.length || volunteers.length)) {
          syncFromTeamAndVolunteers();
          saveRows();
        }
        render();
      }

      async function saveRows() {
        window.AutoSave?.showSaving?.();
        const { error } = await sb.from('productions').update({ production_support_list: rows }).eq('id', prodId);
        if (error) { console.warn('[BTS] support list save error:', error.message); return; }
        window.AutoSave?.showSaved?.();
      }

      // ── Editor ───────────────────────────────────────────────────────
      function editorRowHtml(row) {
        const chips = row.entries.map((entry, i) => `<span class="spl-chip">${esc(resolveName(entry))}<button type="button" class="spl-chip-x" onclick="VolunteerSupportListModule.removeName('${row.id}',${i})" title="Remove">&times;</button></span>`).join('');
        return `<div class="spl-row" data-row="${row.id}">
          <input class="spl-label-input" value="${esc(row.label)}" placeholder="Role label, e.g. Stage Manager" onchange="VolunteerSupportListModule.setLabel('${row.id}',this.value)" />
          <div class="spl-chips">${chips}<button type="button" class="spl-add-name-btn" onclick="VolunteerSupportListModule.openAddName('${row.id}')">+ Add Name</button></div>
          <button type="button" class="spl-remove-row-btn" onclick="VolunteerSupportListModule.removeRow('${row.id}')" title="Remove this role">&times;</button>
        </div>`;
      }

      function editorHtml() {
        if (!rows.length) {
          return `<div class="vol-empty-dept">No roles added yet. Add your first one below (Producer, Stage Manager, whatever your programme needs).</div>`;
        }
        return `<div class="spl-editor">${rows.map(editorRowHtml).join('')}</div>`;
      }

      // ── Programme preview (same visual pattern as Cast List) ──────────
      function programmeHtml() {
        if (!rows.length) return '';
        const trs = rows.filter(r => r.label || r.entries.length).map(r => `<tr>
            <td class="spl-role">${esc(r.label || '')}</td>
            <td>${r.entries.length ? r.entries.map(e => esc(resolveName(e))).join('<br>') : '<span class="spl-open">TBD</span>'}</td>
          </tr>`).join('');
        return `<div class="spl-programme-card">
          <div class="spl-programme-title">Production Support</div>
          <table class="spl-table"><tbody>${trs}</tbody></table>
        </div>`;
      }

      function render() {
        const body = document.getElementById('spl-body');
        if (!body) return;
        body.innerHTML = `
          <div class="spl-toolbar">
            <button type="button" class="btn-secondary" onclick="VolunteerSupportListModule.addRow()">+ Add Role</button>
            <button type="button" class="btn-secondary" onclick="VolunteerSupportListModule.syncNow()">Sync Team &amp; Volunteers</button>
            <div style="flex:1;"></div>
            <button type="button" class="btn-secondary" onclick="VolunteerSupportListModule.exportCSV()">Export CSV</button>
            <button type="button" class="btn-primary" onclick="VolunteerSupportListModule.exportPDF()">Export PDF</button>
          </div>
          <div class="spl-columns">
            <div class="spl-col">
              <div class="spl-col-title">Edit</div>
              ${editorHtml()}
            </div>
            <div class="spl-col">
              <div class="spl-col-title">Programme preview</div>
              ${programmeHtml() || '<div class="vol-empty-dept">Add a role to see the preview.</div>'}
            </div>
          </div>
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
      }

      let _addNameRowId = null;

      window.VolunteerSupportListModule.addRow = function () {
        rows.push({ id: newId(), label: '', entries: [] });
        render();
        saveRows();
      };
      window.VolunteerSupportListModule.syncNow = async function () {
        await fetchTeamAndVolunteers();
        const added = syncFromTeamAndVolunteers();
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
        if (selectVal) {
          const [type, id] = selectVal.split(':');
          const source = type === 'team' ? teamMembers : volunteers;
          const match = source.find(x => String(x.id) === id);
          row.entries.push({ type, id, name: match ? match.name : '' });
        } else if (manualVal) {
          row.entries.push({ type: 'manual', name: manualVal });
        } else {
          document.getElementById('spl-picker-error').textContent = 'Pick someone from the list or type a name.';
          document.getElementById('spl-picker-error').classList.add('visible');
          return;
        }
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
        const items = rows.filter(r => r.label || r.entries.length).map(r => ({ role: r.label || '', names: r.entries.length ? r.entries.map(e => resolveName(e)) : ['TBD'] }));
        const totalLines = items.reduce((sum, r) => sum + Math.max(1, r.names.length), 0);

        const doc = new jsPDFCtor({ unit: 'in', format: 'letter', orientation: 'portrait' });
        const pageW = 8.5, marginIn = 0.6, midX = pageW / 2, headerH = 0.45;
        const usableH = 11 - marginIn * 2 - headerH;
        let fontPt = 12;
        const lineHIn = pt => (pt / 72) * 1.35;
        const padIn = pt => (pt / 72) * 0.5;
        const neededH = pt => items.reduce((sum, r) => sum + Math.max(1, r.names.length) * lineHIn(pt) + padIn(pt) * 2, 0);
        const ratio = Math.min(2, Math.max(0.4, usableH / neededH(fontPt)));
        fontPt = fontPt * ratio;
        const lineH = lineHIn(fontPt), pad = padIn(fontPt);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text('Production Support', midX, marginIn + 0.25, { align: 'center' });

        let y = marginIn + headerH;
        items.forEach(item => {
          y += pad;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(fontPt);
          doc.setTextColor(0, 0, 0);
          doc.text(item.role, midX - 0.15, y + lineH * 0.72, { align: 'right', maxWidth: midX - marginIn - 0.15 });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(34);
          item.names.forEach((n, i) => {
            doc.text(n, midX + 0.15, y + lineH * 0.72 + i * lineH, { align: 'left', maxWidth: pageW - marginIn - midX - 0.15 });
          });
          y += item.names.length * lineH + pad;
        });

        doc.save('Production Support List - ' + new Date().toISOString().slice(0, 10) + '.pdf');
      };

      await load();
    },
    destroy() { delete window.VolunteerSupportListModule; },
  };
})();
