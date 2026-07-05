(function () {
  'use strict';

  const PROPOSAL_FOLDER_NAME = 'Production Proposals';
  const STATUS_META = {
    draft:         { label: 'Draft',         color: '#8b7eaa', bg: 'rgba(139,126,170,0.12)' },
    submitted:     { label: 'Submitted',     color: '#3566b8', bg: 'rgba(53,102,184,0.12)' },
    under_review:  { label: 'Under Review',  color: '#d47a1f', bg: 'rgba(212,122,31,0.12)' },
    shortlisted:   { label: 'Shortlisted',   color: '#0f8d70', bg: 'rgba(15,141,112,0.12)' },
    selected:      { label: 'Selected',      color: '#2f7d32', bg: 'rgba(47,125,50,0.12)' },
    not_selected:  { label: 'Not Selected',  color: '#b74b4b', bg: 'rgba(183,75,75,0.12)' },
    archived:      { label: 'Archived',      color: '#4f5967', bg: 'rgba(79,89,103,0.12)' },
  };
  const LEVELS = ['low', 'medium', 'high'];
  const PROPOSAL_TAG = 'proposal-attachment';

  const state = {
    loaded: false,
    loading: false,
    proposals: [],
    selectedProposalId: '',
    compareIds: new Set(),
    proposalFolderId: '',
    attachmentsByProposal: {},
    filterStatus: 'all',
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function fmtDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtCurrency(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(num);
  }

  function fmtRuntime(value) {
    const mins = Number(value);
    if (!Number.isFinite(mins) || mins <= 0) return '—';
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (!hrs) return `${rem} min`;
    if (!rem) return `${hrs} hr`;
    return `${hrs} hr ${rem} min`;
  }

  function showToast(message, isError) {
    if (typeof window.showToast === 'function') window.showToast(message, !!isError);
  }

  function currentOrg() {
    return window.currentOrg || null;
  }

  function currentUser() {
    return window.currentUser || null;
  }

  function sb() {
    return window.sb;
  }

  function proposalRoot() {
    return document.getElementById('production-proposals-root');
  }

  function proposalStatusLabel(status) {
    return STATUS_META[status]?.label || 'Draft';
  }

  function statusPill(status) {
    const meta = STATUS_META[status] || STATUS_META.draft;
    return `<span class="opp-status-pill" style="color:${meta.color};background:${meta.bg};">${esc(meta.label)}</span>`;
  }

  function proposalById(id) {
    return state.proposals.find(item => item.id === id) || null;
  }

  function proposalTag(id) {
    return `proposal:${id}`;
  }

  function proposalKindTag(kind) {
    return `proposal-kind:${kind}`;
  }

  function sanitizeFileName(name) {
    return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  function injectStyles() {
    if (document.getElementById('org-proposals-style')) return;
    const style = document.createElement('style');
    style.id = 'org-proposals-style';
    style.textContent = `
      .opp-shell { display:grid; gap:1.2rem; }
      .opp-toolbar { display:flex; gap:0.8rem; align-items:center; justify-content:space-between; flex-wrap:wrap; }
      .opp-filter-row { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
      .opp-stat-chip { padding:0.45rem 0.75rem; border-radius:999px; background:rgba(87,46,136,0.08); color:#572e88; font-size:0.78rem; font-weight:700; }
      .opp-grid { display:grid; grid-template-columns:minmax(340px, 1.1fr) minmax(0, 1.35fr); gap:1rem; }
      .opp-list-panel, .opp-detail-panel, .opp-compare-panel { background:#fff; border:1px solid rgba(87,46,136,0.12); border-radius:16px; box-shadow:0 12px 35px rgba(87,46,136,0.06); }
      .opp-panel-head { padding:1rem 1.1rem; border-bottom:1px solid rgba(87,46,136,0.08); display:flex; align-items:center; justify-content:space-between; gap:0.75rem; }
      .opp-panel-title { font-size:0.92rem; font-weight:900; color:#1a1530; }
      .opp-panel-copy { font-size:0.78rem; color:#7d6f97; margin-top:0.2rem; }
      .opp-list-wrap { padding:0.85rem; display:grid; gap:0.8rem; max-height:74vh; overflow:auto; }
      .opp-card { border:1px solid rgba(87,46,136,0.1); border-radius:14px; padding:0.95rem; display:grid; gap:0.7rem; cursor:pointer; background:linear-gradient(180deg,#fff,#fbf9ff); }
      .opp-card.active { border-color:#572e88; box-shadow:0 10px 24px rgba(87,46,136,0.12); }
      .opp-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; }
      .opp-card-title { font-size:1rem; font-weight:900; color:#1a1530; line-height:1.15; }
      .opp-card-sub { font-size:0.8rem; color:#7d6f97; margin-top:0.18rem; }
      .opp-status-pill { display:inline-flex; align-items:center; border-radius:999px; padding:0.28rem 0.6rem; font-size:0.72rem; font-weight:800; white-space:nowrap; }
      .opp-meta-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.45rem 0.75rem; }
      .opp-meta-item { font-size:0.77rem; color:#5b4d74; }
      .opp-meta-item strong { display:block; font-size:0.67rem; letter-spacing:0.04em; text-transform:uppercase; color:#9a90b0; margin-bottom:0.12rem; }
      .opp-card-actions { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; }
      .opp-compare-toggle { display:inline-flex; gap:0.35rem; align-items:center; font-size:0.76rem; color:#5b4d74; font-weight:700; }
      .opp-detail-wrap { padding:1.1rem; display:grid; gap:1rem; }
      .opp-empty { padding:2.4rem 1.25rem; text-align:center; color:#9a90b0; font-size:0.88rem; }
      .opp-actions { display:flex; gap:0.55rem; flex-wrap:wrap; }
      .opp-section { border:1px solid rgba(87,46,136,0.08); border-radius:14px; padding:0.95rem 1rem; background:#fff; }
      .opp-section h3 { margin:0 0 0.55rem; font-size:0.9rem; color:#1a1530; }
      .opp-section p { margin:0; font-size:0.85rem; color:#504267; line-height:1.55; white-space:pre-wrap; }
      .opp-section-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.75rem; }
      .opp-kv { background:rgba(87,46,136,0.04); border-radius:12px; padding:0.7rem 0.8rem; }
      .opp-kv-label { font-size:0.67rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#9a90b0; margin-bottom:0.15rem; }
      .opp-kv-value { font-size:0.86rem; font-weight:700; color:#1a1530; }
      .opp-level-row { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:0.55rem; }
      .opp-level-card { border-radius:12px; padding:0.7rem; background:rgba(87,46,136,0.04); }
      .opp-level-card strong { display:block; font-size:0.7rem; text-transform:uppercase; color:#9a90b0; margin-bottom:0.15rem; }
      .opp-level-card span { display:block; font-size:0.84rem; font-weight:800; color:#1a1530; }
      .opp-attachment-list { display:grid; gap:0.55rem; }
      .opp-attachment-item { display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.7rem 0.8rem; border-radius:12px; background:rgba(87,46,136,0.04); }
      .opp-attachment-item a { color:#572e88; font-weight:800; text-decoration:none; }
      .opp-compare-panel { overflow:auto; }
      .opp-compare-grid { display:grid; grid-template-columns:180px repeat(var(--opp-compare-count,2), minmax(200px,1fr)); min-width:640px; }
      .opp-compare-cell { padding:0.8rem 0.9rem; border-bottom:1px solid rgba(87,46,136,0.08); border-right:1px solid rgba(87,46,136,0.08); font-size:0.82rem; color:#4b3d62; background:#fff; }
      .opp-compare-cell.label { font-weight:800; color:#1a1530; background:#faf8ff; }
      .opp-compare-cell.head { background:#f6f1ff; font-weight:900; color:#1a1530; }
      .opp-modal-overlay { display:none; position:fixed; inset:0; background:rgba(26,21,48,0.55); z-index:3200; padding:1rem; align-items:center; justify-content:center; }
      .opp-modal-overlay.open { display:flex; }
      .opp-modal { width:min(1080px,100%); max-height:92vh; overflow:auto; background:#fff; border-radius:18px; box-shadow:0 30px 80px rgba(26,21,48,0.28); }
      .opp-modal-head { padding:1rem 1.15rem; border-bottom:1px solid rgba(87,46,136,0.08); display:flex; align-items:center; justify-content:space-between; gap:0.75rem; position:sticky; top:0; background:#fff; z-index:2; }
      .opp-modal-body { padding:1rem 1.15rem 1.2rem; display:grid; gap:1rem; }
      .opp-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.8rem; }
      .opp-form-grid.three { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .opp-form-span-2 { grid-column:1 / -1; }
      .opp-form-section { border:1px solid rgba(87,46,136,0.1); border-radius:14px; padding:0.95rem 1rem; background:#fff; }
      .opp-form-section h3 { margin:0 0 0.75rem; font-size:0.92rem; color:#1a1530; }
      .opp-form-help { font-size:0.75rem; color:#8f84a5; line-height:1.45; margin-top:0.25rem; }
      .opp-form-actions { position:sticky; bottom:0; background:#fff; padding-top:0.85rem; border-top:1px solid rgba(87,46,136,0.08); display:flex; gap:0.6rem; flex-wrap:wrap; justify-content:flex-end; }
      .opp-note-box { width:100%; min-height:120px; }
      @media (max-width: 1100px) {
        .opp-grid { grid-template-columns:1fr; }
      }
      @media (max-width: 760px) {
        .opp-form-grid, .opp-form-grid.three, .opp-section-grid, .opp-meta-grid, .opp-level-row { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModalShell() {
    if (document.getElementById('proposal-form-modal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="opp-modal-overlay" id="proposal-form-modal">
        <div class="opp-modal">
          <div class="opp-modal-head">
            <div>
              <div class="opp-panel-title" id="proposal-modal-title">New Production Proposal</div>
              <div class="opp-panel-copy">A readable board-packet style pitch before a production exists.</div>
            </div>
            <button type="button" class="btn-secondary" onclick="closeProposalModal()">Close</button>
          </div>
          <div class="opp-modal-body">
            <div id="proposal-form-error" class="form-error-msg"></div>
            <div class="opp-form-section">
              <h3>Show Information</h3>
              <div class="opp-form-grid">
                <div class="form-group"><label class="form-label">Proposed Show Title</label><input class="form-input" id="pp-title" type="text" /></div>
                <div class="form-group"><label class="form-label">Show Version</label><input class="form-input" id="pp-version" type="text" /></div>
                <div class="form-group"><label class="form-label">Licensing Company</label><input class="form-input" id="pp-licensing" type="text" /></div>
                <div class="form-group"><label class="form-label">Estimated Licensing Fee</label><input class="form-input" id="pp-fee" type="number" min="0" step="0.01" /></div>
                <div class="form-group"><label class="form-label">Pitch Submitted By</label><input class="form-input" id="pp-submitted-by" type="text" /></div>
                <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="pp-status">${Object.entries(STATUS_META).map(([key, meta]) => `<option value="${key}">${esc(meta.label)}</option>`).join('')}</select></div>
              </div>
            </div>
            <div class="opp-form-section">
              <h3>Show at a Glance</h3>
              <div class="opp-form-grid three">
                <div class="form-group"><label class="form-label">Runtime (minutes)</label><input class="form-input" id="pp-runtime" type="number" min="0" /></div>
                <div class="form-group"><label class="form-label">Number of Songs</label><input class="form-input" id="pp-songs" type="number" min="0" /></div>
                <div class="form-group"><label class="form-label">Named Roles</label><input class="form-input" id="pp-roles" type="number" min="0" /></div>
                <div class="form-group"><label class="form-label">Intermission</label><select class="form-select" id="pp-intermission"><option value="yes">Yes</option><option value="no">No</option></select></div>
                <div class="form-group opp-form-span-2"><label class="form-label">Genre / Type</label><input class="form-input" id="pp-genre" type="text" placeholder="Musical, play, concert, etc." /></div>
              </div>
            </div>
            <div class="opp-form-section">
              <h3>Story</h3>
              <div class="opp-form-grid">
                <div class="form-group opp-form-span-2"><label class="form-label">Short Synopsis</label><textarea class="form-textarea" id="pp-synopsis"></textarea></div>
                <div class="form-group opp-form-span-2"><label class="form-label">Why is this a good fit for our organization?</label><textarea class="form-textarea" id="pp-fit"></textarea></div>
              </div>
            </div>
            <div class="opp-form-section">
              <h3>Cast</h3>
              <div class="opp-form-grid">
                <div class="form-group opp-form-span-2"><label class="form-label">Character List</label><textarea class="form-textarea" id="pp-character-list"></textarea></div>
                <div class="form-group"><label class="form-label">Ensemble Opportunities</label><textarea class="form-textarea" id="pp-ensemble"></textarea></div>
                <div class="form-group"><label class="form-label">Gender Flexibility</label><textarea class="form-textarea" id="pp-gender-flex"></textarea></div>
              </div>
            </div>
            <div class="opp-form-section">
              <h3>Production</h3>
              <div class="opp-form-grid three">
                <div class="form-group"><label class="form-label">Sets</label><select class="form-select" id="pp-sets">${levelOptions()}</select></div>
                <div class="form-group"><label class="form-label">Costumes</label><select class="form-select" id="pp-costumes">${levelOptions()}</select></div>
                <div class="form-group"><label class="form-label">Choreography</label><select class="form-select" id="pp-choreo">${levelOptions()}</select></div>
                <div class="form-group"><label class="form-label">Music</label><select class="form-select" id="pp-music">${levelOptions()}</select></div>
                <div class="form-group"><label class="form-label">Technical Requirements</label><select class="form-select" id="pp-tech">${levelOptions()}</select></div>
              </div>
            </div>
            <div class="opp-form-section">
              <h3>Considerations</h3>
              <div class="opp-form-grid">
                <div class="form-group"><label class="form-label">Content Warnings</label><textarea class="form-textarea" id="pp-content"></textarea></div>
                <div class="form-group"><label class="form-label">Special Requirements</label><textarea class="form-textarea" id="pp-special"></textarea></div>
                <div class="form-group opp-form-span-2"><label class="form-label">Biggest Challenge</label><textarea class="form-textarea" id="pp-challenge"></textarea></div>
              </div>
            </div>
            <div class="opp-form-section">
              <h3>Attachments</h3>
              <div class="opp-form-grid">
                <div class="form-group"><label class="form-label">Character List Upload</label><input class="form-input" id="pp-character-file" type="file" /></div>
                <div class="form-group"><label class="form-label">Song List Upload</label><input class="form-input" id="pp-song-file" type="file" /></div>
                <div class="form-group opp-form-span-2"><label class="form-label">Other Supporting Documents</label><input class="form-input" id="pp-support-files" type="file" multiple /></div>
              </div>
              <div id="proposal-existing-files" class="opp-attachment-list" style="margin-top:0.8rem;"></div>
            </div>
            <div class="opp-form-section">
              <h3>Additional Notes</h3>
              <div class="opp-form-grid">
                <div class="form-group opp-form-span-2"><label class="form-label">Proposal Notes</label><textarea class="form-textarea" id="pp-additional-notes"></textarea></div>
                <div class="form-group opp-form-span-2"><label class="form-label">Internal Notes</label><textarea class="form-textarea" id="pp-internal-notes"></textarea></div>
              </div>
            </div>
            <div class="opp-form-actions">
              <button type="button" class="btn-secondary" onclick="closeProposalModal()">Cancel</button>
              <button type="button" class="btn-secondary" id="proposal-save-draft-btn" onclick="saveProposalForm('draft')">Save Draft</button>
              <button type="button" class="btn-primary" id="proposal-submit-btn" onclick="saveProposalForm('submit')">Submit Proposal</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('proposal-form-modal').addEventListener('click', function (event) {
      if (event.target === event.currentTarget) closeProposalModal();
    });
  }

  function levelOptions() {
    return LEVELS.map(value => `<option value="${value}">${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('');
  }

  function proposalSort(a, b) {
    return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
  }

  async function ensureProposalFolder() {
    if (state.proposalFolderId) return state.proposalFolderId;
    const org = currentOrg();
    if (!org) return '';
    const { data: found } = await sb().from('org_folders')
      .select('*')
      .eq('organization_id', org.id)
      .ilike('name', PROPOSAL_FOLDER_NAME)
      .limit(1);
    if (found && found[0]?.id) {
      state.proposalFolderId = found[0].id;
      return state.proposalFolderId;
    }
    const { data, error } = await sb().from('org_folders').insert({
      organization_id: org.id,
      name: PROPOSAL_FOLDER_NAME,
      color: '#4f78a8',
      is_default: false,
      sort_order: 999,
    }).select().single();
    if (error) throw error;
    state.proposalFolderId = data.id;
    return state.proposalFolderId;
  }

  async function loadProposalAttachments(proposalId) {
    if (!proposalId || !currentOrg()) return [];
    const tag = proposalTag(proposalId);
    const { data, error } = await sb().from('org_files')
      .select('*')
      .eq('organization_id', currentOrg().id)
      .contains('tags', [tag])
      .order('created_at', { ascending: false });
    if (error) throw error;
    state.attachmentsByProposal[proposalId] = data || [];
    return state.attachmentsByProposal[proposalId];
  }

  function attachmentsForProposal(proposalId) {
    return state.attachmentsByProposal[proposalId] || [];
  }

  function attachmentsByKind(proposalId, kind) {
    return attachmentsForProposal(proposalId).filter(file => Array.isArray(file.tags) && file.tags.includes(proposalKindTag(kind)));
  }

  async function loadProductionProposalsTab() {
    if (state.loading || !currentOrg()) return;
    state.loading = true;
    injectStyles();
    ensureModalShell();
    try {
      await ensureProposalFolder();
      const { data, error } = await sb().from('production_proposals')
        .select('*')
        .eq('organization_id', currentOrg().id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      state.proposals = (data || []).sort(proposalSort);
      if (!state.selectedProposalId || !proposalById(state.selectedProposalId)) {
        state.selectedProposalId = state.proposals[0]?.id || '';
      }
      if (state.selectedProposalId) await loadProposalAttachments(state.selectedProposalId);
      renderProposalsTab();
      state.loaded = true;
    } catch (error) {
      console.error('[BTS] load proposals failed', error);
      if (proposalRoot()) proposalRoot().innerHTML = `<div class="empty-state"><h3>Could not load proposals</h3><p>${esc(error.message || 'Unknown error')}</p></div>`;
      showToast('Could not load production proposals.', true);
    } finally {
      state.loading = false;
    }
  }

  function filteredProposals() {
    if (state.filterStatus === 'all') return [...state.proposals];
    return state.proposals.filter(item => item.status === state.filterStatus);
  }

  function renderProposalsTab() {
    const root = proposalRoot();
    if (!root) return;
    const proposals = filteredProposals();
    const selected = proposalById(state.selectedProposalId);
    root.innerHTML = `
      <div class="opp-shell">
        <div class="opp-toolbar">
          <div>
            <div class="opp-panel-title">Production Proposals</div>
            <div class="opp-panel-copy">Ideas stay here until they are approved and turned into active productions.</div>
          </div>
          <div style="display:flex;gap:0.55rem;flex-wrap:wrap;">
            <button class="btn-secondary" onclick="refreshProductionProposals()">Refresh</button>
            <button class="btn-primary" onclick="openProposalModal()">+ New Proposal</button>
          </div>
        </div>
        <div class="opp-filter-row">
          <span class="opp-stat-chip">${state.proposals.length} proposal${state.proposals.length === 1 ? '' : 's'}</span>
          <span class="opp-stat-chip">${state.proposals.filter(item => item.status === 'submitted' || item.status === 'under_review').length} in review</span>
          <span class="opp-stat-chip">${state.proposals.filter(item => item.status === 'selected').length} selected</span>
          <select class="form-select" style="max-width:220px;" onchange="setProposalStatusFilter(this.value)">
            <option value="all"${state.filterStatus === 'all' ? ' selected' : ''}>All statuses</option>
            ${Object.keys(STATUS_META).map(key => `<option value="${key}"${state.filterStatus === key ? ' selected' : ''}>${esc(STATUS_META[key].label)}</option>`).join('')}
          </select>
        </div>
        ${renderComparePanel()}
        <div class="opp-grid">
          <div class="opp-list-panel">
            <div class="opp-panel-head">
              <div>
                <div class="opp-panel-title">Proposal List</div>
                <div class="opp-panel-copy">Readable cards for quick board review.</div>
              </div>
            </div>
            <div class="opp-list-wrap">
              ${proposals.length ? proposals.map(renderProposalCard).join('') : `<div class="opp-empty">No proposals yet. Start with a draft and build it into a board-ready pitch.</div>`}
            </div>
          </div>
          <div class="opp-detail-panel">
            ${selected ? renderProposalDetail(selected) : `<div class="opp-empty">Select a proposal to read the full packet.</div>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderComparePanel() {
    const ids = [...state.compareIds].filter(id => proposalById(id));
    if (ids.length < 2) return '';
    const proposals = ids.map(id => proposalById(id));
    const rows = [
      ['Status', p => proposalStatusLabel(p.status)],
      ['Licensing', p => p.licensing_company || '—'],
      ['Fee', p => fmtCurrency(p.estimated_licensing_fee)],
      ['Runtime', p => fmtRuntime(p.runtime_minutes)],
      ['Songs', p => p.number_of_songs ?? '—'],
      ['Named Roles', p => p.named_roles ?? '—'],
      ['Intermission', p => p.has_intermission ? 'Yes' : 'No'],
      ['Genre', p => p.genre_type || '—'],
      ['Sets', p => capitalize(p.sets_level)],
      ['Costumes', p => capitalize(p.costumes_level)],
      ['Choreography', p => capitalize(p.choreography_level)],
      ['Music', p => capitalize(p.music_level)],
      ['Tech', p => capitalize(p.technical_requirements_level)],
      ['Submitted By', p => p.pitch_submitted_by || '—'],
      ['Date Submitted', p => fmtDateTime(p.submitted_at || p.created_at)],
    ];
    return `
      <div class="opp-compare-panel">
        <div class="opp-panel-head">
          <div>
            <div class="opp-panel-title">Compare Proposals</div>
            <div class="opp-panel-copy">Side-by-side snapshot for shortlist conversations.</div>
          </div>
          <button class="btn-secondary" onclick="clearProposalCompare()">Clear Compare</button>
        </div>
        <div class="opp-compare-grid" style="--opp-compare-count:${proposals.length};">
          <div class="opp-compare-cell head">Field</div>
          ${proposals.map(p => `<div class="opp-compare-cell head">${esc(p.proposed_show_title || 'Untitled')}</div>`).join('')}
          ${rows.map(([label, formatter]) => `<div class="opp-compare-cell label">${esc(label)}</div>${proposals.map(p => `<div class="opp-compare-cell">${esc(formatter(p) || '—')}</div>`).join('')}`).join('')}
        </div>
      </div>
    `;
  }

  function renderProposalCard(proposal) {
    const active = proposal.id === state.selectedProposalId;
    return `
      <div class="opp-card${active ? ' active' : ''}" onclick="selectProductionProposal('${proposal.id}')">
        <div class="opp-card-top">
          <div>
            <div class="opp-card-title">${esc(proposal.proposed_show_title || 'Untitled Proposal')}</div>
            <div class="opp-card-sub">${esc(proposal.show_version || proposal.genre_type || 'Show proposal')}</div>
          </div>
          ${statusPill(proposal.status)}
        </div>
        <div class="opp-meta-grid">
          ${cardMeta('Submitted By', proposal.pitch_submitted_by || '—')}
          ${cardMeta('Date Submitted', fmtDateTime(proposal.submitted_at || proposal.created_at))}
          ${cardMeta('Licensing', proposal.licensing_company || '—')}
          ${cardMeta('Fee', fmtCurrency(proposal.estimated_licensing_fee))}
          ${cardMeta('Runtime', fmtRuntime(proposal.runtime_minutes))}
          ${cardMeta('Songs', proposal.number_of_songs ?? '—')}
          ${cardMeta('Named Roles', proposal.named_roles ?? '—')}
          ${cardMeta('Updated', fmtDateTime(proposal.updated_at))}
        </div>
        <div class="opp-card-actions">
          <label class="opp-compare-toggle" onclick="event.stopPropagation()">
            <input type="checkbox" ${state.compareIds.has(proposal.id) ? 'checked' : ''} onchange="toggleProposalCompare('${proposal.id}', this.checked)" />
            Compare
          </label>
          <button type="button" class="btn-secondary" onclick="event.stopPropagation();openProposalModal('${proposal.id}')" style="padding:0.42rem 0.8rem;font-size:0.78rem;">Edit</button>
        </div>
      </div>
    `;
  }

  function cardMeta(label, value) {
    return `<div class="opp-meta-item"><strong>${esc(label)}</strong>${esc(value)}</div>`;
  }

  function renderProposalDetail(proposal) {
    const attachments = attachmentsForProposal(proposal.id);
    const proposalFileRows = attachments.length
      ? `<div class="opp-attachment-list">${attachments.map(file => renderAttachment(file)).join('')}</div>`
      : '<p>No uploaded attachments yet.</p>';
    return `
      <div class="opp-panel-head">
        <div>
          <div class="opp-panel-title">${esc(proposal.proposed_show_title || 'Untitled Proposal')}</div>
          <div class="opp-panel-copy">${esc(proposal.show_version || proposal.licensing_company || 'Production proposal packet')}</div>
        </div>
        ${statusPill(proposal.status)}
      </div>
      <div class="opp-detail-wrap">
        <div class="opp-actions">
          <button class="btn-secondary" onclick="openProposalModal('${proposal.id}')">Edit Proposal</button>
          <button class="btn-secondary" onclick="exportProposalPdf('${proposal.id}')">Download / Export PDF</button>
          <button class="btn-secondary" onclick="archiveProposal('${proposal.id}')">Archive Proposal</button>
          <button class="btn-primary" onclick="createProductionFromProposal('${proposal.id}')">Create Production</button>
        </div>
        <div class="opp-section-grid">
          <div class="opp-kv"><div class="opp-kv-label">Submitted By</div><div class="opp-kv-value">${esc(proposal.pitch_submitted_by || '—')}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Date Submitted</div><div class="opp-kv-value">${esc(fmtDateTime(proposal.submitted_at || proposal.created_at))}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Licensing Company</div><div class="opp-kv-value">${esc(proposal.licensing_company || '—')}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Estimated Licensing Fee</div><div class="opp-kv-value">${esc(fmtCurrency(proposal.estimated_licensing_fee))}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Runtime</div><div class="opp-kv-value">${esc(fmtRuntime(proposal.runtime_minutes))}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Songs / Named Roles</div><div class="opp-kv-value">${esc(`${proposal.number_of_songs ?? '—'} songs · ${proposal.named_roles ?? '—'} roles`)}</div></div>
        </div>
        <div class="opp-section"><h3>Story</h3><p>${esc(proposal.short_synopsis || 'No synopsis yet.')}</p><div style="height:0.8rem;"></div><p>${esc(proposal.organization_fit || 'No organization-fit notes yet.')}</p></div>
        <div class="opp-section"><h3>Cast</h3><p>${esc(proposal.character_list || 'No character list added yet.')}</p><div style="height:0.8rem;"></div><p><strong>Ensemble opportunities:</strong> ${esc(proposal.ensemble_opportunities || '—')}</p><div style="height:0.35rem;"></div><p><strong>Gender flexibility:</strong> ${esc(proposal.gender_flexibility || '—')}</p></div>
        <div class="opp-section"><h3>Production Complexity</h3>
          <div class="opp-level-row">
            ${levelCell('Sets', proposal.sets_level)}
            ${levelCell('Costumes', proposal.costumes_level)}
            ${levelCell('Choreography', proposal.choreography_level)}
            ${levelCell('Music', proposal.music_level)}
            ${levelCell('Technical', proposal.technical_requirements_level)}
          </div>
        </div>
        <div class="opp-section"><h3>Considerations</h3><p><strong>Content warnings:</strong> ${esc(proposal.content_warnings || '—')}</p><div style="height:0.55rem;"></div><p><strong>Special requirements:</strong> ${esc(proposal.special_requirements || '—')}</p><div style="height:0.55rem;"></div><p><strong>Biggest challenge:</strong> ${esc(proposal.biggest_challenge || '—')}</p></div>
        <div class="opp-section"><h3>Attachments</h3>${proposalFileRows}</div>
        <div class="opp-section"><h3>Additional Notes</h3><p>${esc(proposal.additional_notes || 'No additional notes.')}</p></div>
        <div class="opp-section">
          <h3>Internal Notes</h3>
          <textarea class="form-textarea opp-note-box" id="proposal-internal-note-box">${escTextArea(proposal.internal_notes || '')}</textarea>
          <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem;">
            <select class="form-select" id="proposal-status-select" style="max-width:260px;">
              ${Object.entries(STATUS_META).map(([key, meta]) => `<option value="${key}"${proposal.status === key ? ' selected' : ''}>${esc(meta.label)}</option>`).join('')}
            </select>
            <div style="display:flex;gap:0.55rem;flex-wrap:wrap;">
              <button class="btn-secondary" onclick="saveProposalInternalNotes('${proposal.id}')">Save Internal Notes</button>
              <button class="btn-primary" onclick="changeProposalStatus('${proposal.id}', document.getElementById('proposal-status-select').value)">Change Status</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function levelCell(label, value) {
    return `<div class="opp-level-card"><strong>${esc(label)}</strong><span>${esc(capitalize(value) || '—')}</span></div>`;
  }

  function renderAttachment(file) {
    const kind = (file.tags || []).find(tag => String(tag).startsWith('proposal-kind:')) || 'proposal-kind:supporting_document';
    const label = kind.replace('proposal-kind:', '').replace(/_/g, ' ');
    return `<div class="opp-attachment-item"><div><div class="opp-kv-label">${esc(capitalize(label))}</div><a href="${esc(file.file_url)}" target="_blank" rel="noopener">${esc(file.name || 'Attachment')}</a></div><button class="btn-secondary" style="padding:0.38rem 0.7rem;font-size:0.76rem;" onclick="deleteProposalAttachment('${file.id}')">Remove</button></div>`;
  }

  function escTextArea(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function capitalize(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, ' ');
  }

  function setProposalStatusFilter(value) {
    state.filterStatus = value || 'all';
    renderProposalsTab();
  }

  async function selectProductionProposal(id) {
    state.selectedProposalId = id;
    if (!state.attachmentsByProposal[id]) await loadProposalAttachments(id);
    renderProposalsTab();
  }

  function toggleProposalCompare(id, checked) {
    if (checked) {
      if (state.compareIds.size >= 3 && !state.compareIds.has(id)) {
        showToast('Compare up to 3 proposals at a time.', true);
        renderProposalsTab();
        return;
      }
      state.compareIds.add(id);
    } else {
      state.compareIds.delete(id);
    }
    renderProposalsTab();
  }

  function clearProposalCompare() {
    state.compareIds.clear();
    renderProposalsTab();
  }

  function formProposalData() {
    return {
      proposed_show_title: document.getElementById('pp-title').value.trim(),
      show_version: document.getElementById('pp-version').value.trim() || null,
      licensing_company: document.getElementById('pp-licensing').value.trim() || null,
      estimated_licensing_fee: document.getElementById('pp-fee').value ? Number(document.getElementById('pp-fee').value) : null,
      pitch_submitted_by: document.getElementById('pp-submitted-by').value.trim() || null,
      status: document.getElementById('pp-status').value || 'draft',
      runtime_minutes: document.getElementById('pp-runtime').value ? Number(document.getElementById('pp-runtime').value) : null,
      number_of_songs: document.getElementById('pp-songs').value ? Number(document.getElementById('pp-songs').value) : null,
      named_roles: document.getElementById('pp-roles').value ? Number(document.getElementById('pp-roles').value) : null,
      has_intermission: document.getElementById('pp-intermission').value === 'yes',
      genre_type: document.getElementById('pp-genre').value.trim() || null,
      short_synopsis: document.getElementById('pp-synopsis').value.trim() || null,
      organization_fit: document.getElementById('pp-fit').value.trim() || null,
      character_list: document.getElementById('pp-character-list').value.trim() || null,
      ensemble_opportunities: document.getElementById('pp-ensemble').value.trim() || null,
      gender_flexibility: document.getElementById('pp-gender-flex').value.trim() || null,
      sets_level: document.getElementById('pp-sets').value || 'medium',
      costumes_level: document.getElementById('pp-costumes').value || 'medium',
      choreography_level: document.getElementById('pp-choreo').value || 'medium',
      music_level: document.getElementById('pp-music').value || 'medium',
      technical_requirements_level: document.getElementById('pp-tech').value || 'medium',
      content_warnings: document.getElementById('pp-content').value.trim() || null,
      special_requirements: document.getElementById('pp-special').value.trim() || null,
      biggest_challenge: document.getElementById('pp-challenge').value.trim() || null,
      additional_notes: document.getElementById('pp-additional-notes').value.trim() || null,
      internal_notes: document.getElementById('pp-internal-notes').value.trim() || null,
    };
  }

  function openProposalModal(id) {
    ensureModalShell();
    const proposal = id ? proposalById(id) : null;
    const modal = document.getElementById('proposal-form-modal');
    modal.dataset.proposalId = id || '';
    document.getElementById('proposal-modal-title').textContent = proposal ? 'Edit Production Proposal' : 'New Production Proposal';
    document.getElementById('proposal-form-error').classList.remove('visible');
    document.getElementById('proposal-form-error').textContent = '';
    document.getElementById('pp-title').value = proposal?.proposed_show_title || '';
    document.getElementById('pp-version').value = proposal?.show_version || '';
    document.getElementById('pp-licensing').value = proposal?.licensing_company || '';
    document.getElementById('pp-fee').value = proposal?.estimated_licensing_fee ?? '';
    document.getElementById('pp-submitted-by').value = proposal?.pitch_submitted_by || currentUser()?.email || '';
    document.getElementById('pp-status').value = proposal?.status || 'draft';
    document.getElementById('pp-runtime').value = proposal?.runtime_minutes ?? '';
    document.getElementById('pp-songs').value = proposal?.number_of_songs ?? '';
    document.getElementById('pp-roles').value = proposal?.named_roles ?? '';
    document.getElementById('pp-intermission').value = proposal?.has_intermission ? 'yes' : 'no';
    document.getElementById('pp-genre').value = proposal?.genre_type || '';
    document.getElementById('pp-synopsis').value = proposal?.short_synopsis || '';
    document.getElementById('pp-fit').value = proposal?.organization_fit || '';
    document.getElementById('pp-character-list').value = proposal?.character_list || '';
    document.getElementById('pp-ensemble').value = proposal?.ensemble_opportunities || '';
    document.getElementById('pp-gender-flex').value = proposal?.gender_flexibility || '';
    document.getElementById('pp-sets').value = proposal?.sets_level || 'medium';
    document.getElementById('pp-costumes').value = proposal?.costumes_level || 'medium';
    document.getElementById('pp-choreo').value = proposal?.choreography_level || 'medium';
    document.getElementById('pp-music').value = proposal?.music_level || 'medium';
    document.getElementById('pp-tech').value = proposal?.technical_requirements_level || 'medium';
    document.getElementById('pp-content').value = proposal?.content_warnings || '';
    document.getElementById('pp-special').value = proposal?.special_requirements || '';
    document.getElementById('pp-challenge').value = proposal?.biggest_challenge || '';
    document.getElementById('pp-additional-notes').value = proposal?.additional_notes || '';
    document.getElementById('pp-internal-notes').value = proposal?.internal_notes || '';
    document.getElementById('pp-character-file').value = '';
    document.getElementById('pp-song-file').value = '';
    document.getElementById('pp-support-files').value = '';
    renderExistingFilesForModal(id || '');
    modal.classList.add('open');
  }

  function renderExistingFilesForModal(proposalId) {
    const host = document.getElementById('proposal-existing-files');
    if (!host) return;
    if (!proposalId) {
      host.innerHTML = '<div class="opp-form-help">Save the proposal first if you want attachment slots that can be replaced later.</div>';
      return;
    }
    const files = attachmentsForProposal(proposalId);
    host.innerHTML = files.length ? files.map(renderAttachment).join('') : '<div class="opp-form-help">No attachments uploaded yet.</div>';
  }

  function closeProposalModal() {
    document.getElementById('proposal-form-modal')?.classList.remove('open');
  }

  async function saveProposalForm(mode) {
    const modal = document.getElementById('proposal-form-modal');
    const proposalId = modal?.dataset?.proposalId || '';
    const errorEl = document.getElementById('proposal-form-error');
    const org = currentOrg();
    const user = currentUser();
    if (!org || !user) return;
    const payload = formProposalData();
    if (!payload.proposed_show_title) {
      errorEl.textContent = 'Proposed show title is required.';
      errorEl.classList.add('visible');
      return;
    }
    if (mode === 'submit') {
      payload.status = payload.status === 'draft' ? 'submitted' : payload.status;
      payload.submitted_at = new Date().toISOString();
    }
    payload.organization_id = org.id;
    payload.pitch_submitted_by_user_id = user.id;
    try {
      let saved;
      if (proposalId) {
        const existing = proposalById(proposalId);
        if (existing?.submitted_at && mode !== 'submit') delete payload.submitted_at;
        const { data, error } = await sb().from('production_proposals').update(payload).eq('id', proposalId).select().single();
        if (error) throw error;
        saved = data;
      } else {
        if (mode !== 'submit') delete payload.submitted_at;
        const { data, error } = await sb().from('production_proposals').insert(payload).select().single();
        if (error) throw error;
        saved = data;
      }
      await syncProposalAttachments(saved.id);
      closeProposalModal();
      await refreshProductionProposals(saved.id);
      showToast(mode === 'submit' ? 'Proposal submitted.' : 'Proposal saved.');
    } catch (error) {
      console.error('[BTS] save proposal failed', error);
      errorEl.textContent = error.message || 'Could not save proposal.';
      errorEl.classList.add('visible');
    }
  }

  async function syncProposalAttachments(proposalId) {
    if (!proposalId) return;
    await ensureProposalFolder();
    const characterFile = document.getElementById('pp-character-file').files[0];
    const songFile = document.getElementById('pp-song-file').files[0];
    const supportFiles = Array.from(document.getElementById('pp-support-files').files || []);
    if (characterFile) await replaceProposalAttachment(proposalId, 'character_list', characterFile);
    if (songFile) await replaceProposalAttachment(proposalId, 'song_list', songFile);
    for (const file of supportFiles) {
      await addProposalAttachment(proposalId, 'supporting_document', file);
    }
    if (characterFile || songFile || supportFiles.length) {
      await loadProposalAttachments(proposalId);
    }
  }

  async function replaceProposalAttachment(proposalId, kind, file) {
    const existing = attachmentsByKind(proposalId, kind);
    for (const row of existing) {
      await deleteProposalAttachment(row.id, false);
    }
    await addProposalAttachment(proposalId, kind, file);
  }

  async function addProposalAttachment(proposalId, kind, file) {
    const path = `${currentOrg().id}/${state.proposalFolderId}/proposals/${proposalId}/${kind}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await sb().storage.from('org-files').upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data: urlData } = sb().storage.from('org-files').getPublicUrl(path);
    const { data, error } = await sb().from('org_files').insert({
      organization_id: currentOrg().id,
      folder_id: state.proposalFolderId,
      name: file.name,
      file_url: urlData.publicUrl,
      file_path: path,
      file_type: file.type || null,
      file_size: file.size || null,
      tags: [PROPOSAL_TAG, proposalTag(proposalId), proposalKindTag(kind)],
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function deleteProposalAttachment(fileId, rerender = true) {
    const files = Object.values(state.attachmentsByProposal).flat();
    const match = files.find(item => item.id === fileId);
    if (!match) return;
    if (match.file_path) {
      await sb().storage.from('org-files').remove([match.file_path]).catch(() => {});
    }
    const { error } = await sb().from('org_files').delete().eq('id', fileId);
    if (error) throw error;
    Object.keys(state.attachmentsByProposal).forEach(key => {
      state.attachmentsByProposal[key] = (state.attachmentsByProposal[key] || []).filter(item => item.id !== fileId);
    });
    if (rerender) renderProposalsTab();
  }

  async function refreshProductionProposals(selectId) {
    state.selectedProposalId = selectId || state.selectedProposalId;
    await loadProductionProposalsTab();
  }

  async function changeProposalStatus(proposalId, nextStatus) {
    try {
      const payload = { status: nextStatus };
      if (nextStatus === 'selected') payload.selected_at = new Date().toISOString();
      const { data, error } = await sb().from('production_proposals').update(payload).eq('id', proposalId).select().single();
      if (error) throw error;
      state.proposals = state.proposals.map(item => item.id === proposalId ? data : item).sort(proposalSort);
      renderProposalsTab();
      showToast('Proposal status updated.');
    } catch (error) {
      showToast(error.message || 'Could not update status.', true);
    }
  }

  async function saveProposalInternalNotes(proposalId) {
    const value = document.getElementById('proposal-internal-note-box')?.value || '';
    try {
      const { data, error } = await sb().from('production_proposals').update({ internal_notes: value }).eq('id', proposalId).select().single();
      if (error) throw error;
      state.proposals = state.proposals.map(item => item.id === proposalId ? data : item).sort(proposalSort);
      renderProposalsTab();
      showToast('Internal notes saved.');
    } catch (error) {
      showToast(error.message || 'Could not save notes.', true);
    }
  }

  async function archiveProposal(proposalId) {
    if (!window.confirm('Archive this proposal? It will stay in the records but move out of the active review flow.')) return;
    await changeProposalStatus(proposalId, 'archived');
  }

  function exportProposalPdf(proposalId) {
    const proposal = proposalById(proposalId);
    if (!proposal) return;
    const attachments = attachmentsForProposal(proposalId);
    const html = `
      <html><head><title>${esc(proposal.proposed_show_title)} Proposal</title><style>
        body{font-family:Arial,sans-serif;color:#1a1530;padding:28px;line-height:1.45}
        h1,h2{margin:0 0 10px} h2{margin-top:24px;font-size:18px}
        .muted{color:#6a5a80;font-size:13px} .box{border:1px solid #ddd;border-radius:10px;padding:14px;margin-top:10px}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .label{font-size:11px;text-transform:uppercase;color:#7a7092;font-weight:700}
        .value{font-size:14px;font-weight:700}
      </style></head><body>
        <h1>${esc(proposal.proposed_show_title || 'Untitled Proposal')}</h1>
        <div class="muted">${esc(proposalStatusLabel(proposal.status))} · Submitted by ${esc(proposal.pitch_submitted_by || '—')} · ${esc(fmtDateTime(proposal.submitted_at || proposal.created_at))}</div>
        <div class="grid" style="margin-top:16px;">
          <div class="box"><div class="label">Licensing Company</div><div class="value">${esc(proposal.licensing_company || '—')}</div></div>
          <div class="box"><div class="label">Estimated Licensing Fee</div><div class="value">${esc(fmtCurrency(proposal.estimated_licensing_fee))}</div></div>
          <div class="box"><div class="label">Runtime</div><div class="value">${esc(fmtRuntime(proposal.runtime_minutes))}</div></div>
          <div class="box"><div class="label">Songs / Named Roles</div><div class="value">${esc(`${proposal.number_of_songs ?? '—'} / ${proposal.named_roles ?? '—'}`)}</div></div>
        </div>
        <h2>Synopsis</h2><div class="box">${esc(proposal.short_synopsis || '—')}</div>
        <h2>Why this fits</h2><div class="box">${esc(proposal.organization_fit || '—')}</div>
        <h2>Cast</h2><div class="box">${esc(proposal.character_list || '—')}</div>
        <h2>Considerations</h2><div class="box">${esc(proposal.biggest_challenge || '—')}</div>
        <h2>Internal Notes</h2><div class="box">${esc(proposal.internal_notes || '—')}</div>
        <h2>Attachments</h2><div class="box">${attachments.map(file => esc(file.name)).join('<br>') || 'None'}</div>
      </body></html>`;
    const w = window.open('', '_blank', 'noopener');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  async function getNextProductionNumber() {
    const { data, error } = await sb().from('productions').select('id').eq('organization_id', currentOrg().id);
    return error ? 1 : (data?.length || 0) + 1;
  }

  async function ensureUniqueProductionSlug(title) {
    const base = (window.slugifyProductionUrlPart ? window.slugifyProductionUrlPart(title) : String(title || 'production').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) || 'production';
    let candidate = base;
    let attempt = 1;
    while (attempt < 100) {
      const { data } = await sb().from('productions').select('id').eq('organization_id', currentOrg().id).eq('slug', candidate).limit(1);
      if (!data?.length) return candidate;
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return `${base}-${Date.now().toString().slice(-5)}`;
  }

  function mapProposalTypeToProductionType(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('musical')) return 'musical';
    if (raw.includes('play') || raw.includes('drama') || raw.includes('comedy')) return 'play';
    if (raw.includes('concert')) return 'concert';
    if (raw.includes('opera')) return 'opera';
    if (raw.includes('dance')) return 'dance';
    if (raw.includes('workshop')) return 'workshop';
    return 'other';
  }

  async function ensureProposalImportFolder(productionId) {
    const { data: found } = await sb().from('production_folders')
      .select('*')
      .eq('production_id', productionId)
      .ilike('name', 'Proposal Import')
      .limit(1);
    if (found && found[0]?.id) return found[0];
    const { data, error } = await sb().from('production_folders').insert({
      production_id: productionId,
      name: 'Proposal Import',
      color: '#476aaa',
      is_default: false,
      sort_order: 998,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function copyProposalFilesToProduction(proposal, productionId) {
    const attachments = state.attachmentsByProposal[proposal.id] || await loadProposalAttachments(proposal.id);
    if (!attachments.length) return;
    const folder = await ensureProposalImportFolder(productionId);
    const rows = attachments.map(file => {
      const kindTag = (file.tags || []).find(tag => String(tag).startsWith('proposal-kind:')) || 'proposal-kind:supporting_document';
      return {
        production_id: productionId,
        folder_id: folder.id,
        name: file.name,
        file_url: file.file_url,
        file_path: null,
        file_type: file.file_type || null,
        file_size: file.file_size || null,
        tags: ['proposal-import', kindTag.replace('proposal-kind:', '')],
      };
    });
    const { error } = await sb().from('production_files').insert(rows);
    if (error) throw error;
  }

  async function createProductionFromProposal(proposalId) {
    const proposal = proposalById(proposalId);
    if (!proposal) return;
    if (proposal.selected_production_id) {
      showToast('This proposal already created a production.', true);
      return;
    }
    if (proposal.status !== 'selected') {
      showToast('Change the proposal to Selected before creating a production.', true);
      return;
    }
    if (!window.confirm(`Create a draft production from "${proposal.proposed_show_title}"?`)) return;
    try {
      const prodType = mapProposalTypeToProductionType(proposal.genre_type);
      const slug = await ensureUniqueProductionSlug(proposal.proposed_show_title || 'production');
      const num = await getNextProductionNumber();
      const customIdPrefix = currentOrg().custom_id || 'ORG';
      const custom_id = `${customIdPrefix}-${String(num).padStart(2, '0')}`;
      const proposalImport = {
        proposal_id: proposal.id,
        show_version: proposal.show_version || '',
        licensing_company: proposal.licensing_company || '',
        estimated_licensing_fee: proposal.estimated_licensing_fee || null,
        runtime_minutes: proposal.runtime_minutes || null,
        number_of_songs: proposal.number_of_songs || null,
        named_roles: proposal.named_roles || null,
        has_intermission: !!proposal.has_intermission,
        genre_type: proposal.genre_type || '',
        short_synopsis: proposal.short_synopsis || '',
        organization_fit: proposal.organization_fit || '',
        character_list: proposal.character_list || '',
        ensemble_opportunities: proposal.ensemble_opportunities || '',
        gender_flexibility: proposal.gender_flexibility || '',
        complexity: {
          sets: proposal.sets_level || '',
          costumes: proposal.costumes_level || '',
          choreography: proposal.choreography_level || '',
          music: proposal.music_level || '',
          technical_requirements: proposal.technical_requirements_level || '',
        },
        considerations: {
          content_warnings: proposal.content_warnings || '',
          special_requirements: proposal.special_requirements || '',
          biggest_challenge: proposal.biggest_challenge || '',
        },
        additional_notes: proposal.additional_notes || '',
        internal_notes: proposal.internal_notes || '',
        attachments: (state.attachmentsByProposal[proposal.id] || await loadProposalAttachments(proposal.id)).map(file => ({
          name: file.name,
          file_url: file.file_url,
          file_type: file.file_type || '',
          file_size: file.file_size || null,
          tags: file.tags || [],
        })),
      };
      const descriptionParts = [proposal.short_synopsis, proposal.organization_fit].filter(Boolean);
      const { data, error } = await sb().from('productions').insert({
        organization_id: currentOrg().id,
        custom_id,
        title: proposal.proposed_show_title,
        description: descriptionParts.join('\n\n') || null,
        production_type: prodType,
        is_public: false,
        status: 'setup',
        slug,
        wizard_data: { proposal_import: proposalImport },
      }).select('id').single();
      if (error) throw error;
      await copyProposalFilesToProduction(proposal, data.id);
      await sb().from('production_proposals').update({
        status: 'archived',
        selected_production_id: data.id,
        selected_at: proposal.selected_at || new Date().toISOString(),
      }).eq('id', proposal.id);

      const wizardState = {
        title: proposal.proposed_show_title || '',
        description: proposal.short_synopsis || '',
        production_type: prodType,
        is_public: false,
        proposal_import: proposalImport,
      };
      localStorage.setItem('bts_wizard_state', JSON.stringify(wizardState));
      localStorage.setItem('bts_wizard_prod_id', data.id);
      localStorage.setItem('bts_wizard_auto_resume', '1');
      if (typeof window.loadProductions === 'function') window.loadProductions();
      showToast('Draft production created from proposal.');
      window.location.href = (typeof window.productionWizardUrl === 'function')
        ? window.productionWizardUrl('full')
        : '/org/production/new?mode=full';
    } catch (error) {
      console.error('[BTS] create production from proposal failed', error);
      showToast(error.message || 'Could not create production from proposal.', true);
    }
  }

  window.loadProductionProposalsTab = loadProductionProposalsTab;
  window.openProposalModal = openProposalModal;
  window.closeProposalModal = closeProposalModal;
  window.saveProposalForm = saveProposalForm;
  window.selectProductionProposal = selectProductionProposal;
  window.toggleProposalCompare = toggleProposalCompare;
  window.clearProposalCompare = clearProposalCompare;
  window.refreshProductionProposals = refreshProductionProposals;
  window.setProposalStatusFilter = setProposalStatusFilter;
  window.changeProposalStatus = changeProposalStatus;
  window.saveProposalInternalNotes = saveProposalInternalNotes;
  window.archiveProposal = archiveProposal;
  window.exportProposalPdf = exportProposalPdf;
  window.deleteProposalAttachment = function (fileId) { deleteProposalAttachment(fileId).catch(err => showToast(err.message || 'Could not remove attachment.', true)); };
  window.createProductionFromProposal = createProductionFromProposal;
}());
