(function () {
  'use strict';

  const PROPOSAL_FOLDER_NAME = 'Production Proposals';
  const STATUS_META = {
    draft:         { label: 'Draft',         color: '#7b6f99', bg: 'rgba(139,126,170,0.12)' },
    submitted:     { label: 'Submitted',     color: '#476aaa', bg: 'rgba(71,106,170,0.14)' },
    under_review:  { label: 'Under Review',  color: '#b85e00', bg: 'rgba(239,171,69,0.22)' },
    shortlisted:   { label: 'Shortlisted',   color: '#2070a0', bg: 'rgba(120,187,212,0.22)' },
    selected:      { label: 'Selected',      color: '#3a6646', bg: 'rgba(118,158,123,0.2)' },
    not_selected:  { label: 'Not Selected',  color: '#5a6370', bg: 'rgba(90,99,112,0.12)' },
    archived:      { label: 'Archived',      color: '#5a6370', bg: 'rgba(90,99,112,0.12)' },
  };
  const LEVELS = ['low', 'medium', 'high'];
  const PROPOSAL_TAG = 'proposal-attachment';
  const INTAKE_STATUS_META = {
    open:    { label: 'Open',    color: '#3a6646', bg: 'rgba(118,158,123,0.2)'  },
    closed:  { label: 'Draft',   color: '#5a6370', bg: 'rgba(90,99,112,0.12)'   },
    expired: { label: 'Expired', color: '#b85e00', bg: 'rgba(239,171,69,0.22)'  },
  };

  const state = {
    loaded: false,
    loading: false,
    proposals: [],
    intakes: [],
    selectedProposalId: '',
    selectedIntakeId: 'all',
    expandedYearId: null,
    compareIds: new Set(),
    proposalFolderId: '',
    attachmentsByProposal: {},
    filterStatus: 'all',
    searchQuery: '',
    queryIntentHandled: false,
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

  function proposalIntentFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('proposal') || '';
  }

  function clearProposalIntentFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('proposal');
    window.history.replaceState({}, '', url.toString());
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
      /* ---- shell ---- */
      .opp-shell { display:flex; flex-direction:column; gap:1.25rem; }
      .pp-page-actions { display:flex; gap:0.65rem; flex-wrap:wrap; }
      .pp-section-label { font-size:1.25rem; font-weight:900; color:#1a1530; margin:0; }

      /* ---- stat row ---- */
      .pp-stat-row { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:0.85rem; }
      .pp-stat-card { background:#fff; border:1px solid rgba(87,46,136,0.1); border-radius:14px; padding:1.1rem 1.2rem; display:flex; align-items:center; gap:0.95rem; }
      .pp-stat-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .pp-stat-icon img { width:22px; height:22px; }
      .pp-stat-body { min-width:0; }
      .pp-stat-label { font-size:0.72rem; font-weight:700; color:rgba(26,21,48,0.5); margin-bottom:0.15rem; }
      .pp-stat-value { font-size:1.75rem; font-weight:900; color:#000; line-height:1; }
      .pp-stat-sub { font-size:0.7rem; color:rgba(26,21,48,0.4); margin-top:0.18rem; }

      /* ---- toolbar ---- */
      .pp-toolbar { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; background:#fff; border:1px solid rgba(87,46,136,0.1); border-radius:12px; padding:0.75rem 1rem; }
      .pp-search-wrap { display:flex; align-items:center; gap:0.45rem; flex:1; min-width:160px; }
      .pp-search-icon { width:16px; height:16px; opacity:0.35; flex-shrink:0; }
      .pp-search { border:none; outline:none; font-family:var(--bts-font); font-size:0.86rem; color:#1a1530; background:transparent; flex:1; min-width:0; }
      .pp-search::placeholder { color:rgba(26,21,48,0.35); }
      .pp-toolbar-divider { width:1px; height:22px; background:rgba(87,46,136,0.12); flex-shrink:0; }
      .pp-filter-select { font-family:var(--bts-font); font-size:0.82rem; color:#1a1530; border:1.5px solid rgba(87,46,136,0.2); border-radius:8px; background:#fff; padding:0.42rem 0.75rem; cursor:pointer; }
      .pp-filter-btn { font-family:var(--bts-font); font-size:0.82rem; font-weight:700; color:#572e88; border:1.5px solid rgba(87,46,136,0.2); border-radius:8px; background:#fff; padding:0.42rem 0.85rem; cursor:pointer; display:flex; align-items:center; gap:0.35rem; }
      .pp-intake-panel { display:grid; gap:0.9rem; }
      .pp-intake-head { display:flex; gap:0.75rem; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; }
      .pp-intake-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1rem; }
      .pp-intake-card { border:1px solid rgba(87,46,136,0.12); border-radius:16px; padding:1rem; background:#fff; display:grid; gap:0.85rem; box-shadow:0 8px 22px rgba(26,21,48,0.04); }
      .pp-intake-card.active { border-color:#572e88; box-shadow:0 10px 24px rgba(87,46,136,0.12); }
      .pp-intake-top { display:flex; gap:0.75rem; align-items:flex-start; justify-content:space-between; }
      .pp-intake-title { font-size:0.98rem; font-weight:900; color:#1a1530; line-height:1.25; }
      .pp-intake-sub { display:none; }
      .pp-intake-meta { display:grid; gap:0.65rem; }
      .pp-intake-meta-item { display:flex; align-items:center; justify-content:space-between; gap:0.75rem; font-size:0.82rem; color:#1a1530; }
      .pp-intake-meta-item strong { display:flex; align-items:center; gap:0.45rem; font-size:0.79rem; font-weight:700; color:#1a1530; }
      .pp-intake-meta-item strong::before { content:""; width:14px; height:14px; border-radius:4px; background:rgba(87,46,136,0.08); flex-shrink:0; }
      .pp-intake-meta-code { font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace; font-size:0.8rem; font-weight:700; letter-spacing:0.04em; color:#572e88; }
      .pp-intake-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.65rem; margin-top:0.25rem; }
      .pp-intake-empty { border-radius:16px; padding:1.75rem; text-align:center; border:1px dashed rgba(87,46,136,0.18); color:#8f84a5; background:#fff; }
      .pp-card-btn { display:inline-flex; align-items:center; justify-content:center; width:100%; border-radius:10px; padding:0.7rem 0.95rem; font-family:var(--bts-font); font-size:0.82rem; font-weight:800; cursor:pointer; border:1.5px solid rgba(87,46,136,0.24); background:#fff; color:#572e88; }
      .pp-card-btn.primary { background:#572e88; color:#fff; border-color:#572e88; }
      .pp-season-overview { background:#fff; border:1px solid rgba(87,46,136,0.1); border-radius:14px; padding:1.15rem 1.2rem; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:1rem; align-items:start; }
      .pp-season-overview.is-all { background:rgba(87,46,136,0.04); }
      .pp-season-kicker { font-size:0.7rem; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; color:#9a90b0; margin-bottom:0.3rem; }
      .pp-season-title { font-size:1.15rem; font-weight:900; color:#1a1530; line-height:1.15; }
      .pp-season-copy { margin-top:0.35rem; font-size:0.82rem; color:#6a5a80; line-height:1.55; max-width:760px; }
      .pp-season-meta { display:flex; gap:0.55rem; flex-wrap:wrap; margin-top:0.75rem; }
      .pp-season-chip { display:inline-flex; align-items:center; gap:0.35rem; border-radius:999px; padding:0.35rem 0.65rem; background:rgba(87,46,136,0.06); border:1px solid rgba(87,46,136,0.1); font-size:0.74rem; font-weight:700; color:#572e88; }
      .pp-season-actions { display:flex; gap:0.55rem; flex-wrap:wrap; justify-content:flex-end; }

      /* ---- table ---- */
      .pp-table-wrap { background:#fff; border:1px solid rgba(87,46,136,0.1); border-radius:14px; overflow:hidden; }
      .pp-table { width:100%; border-collapse:collapse; }
      .pp-table thead th { padding:0.75rem 0.9rem; font-size:0.68rem; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; color:rgba(26,21,48,0.45); text-align:left; border-bottom:1px solid rgba(87,46,136,0.08); white-space:nowrap; }
      .pp-table tbody tr { border-bottom:1px solid rgba(87,46,136,0.06); transition:background 0.12s; cursor:pointer; }
      .pp-table tbody tr:last-child { border-bottom:none; }
      .pp-table tbody tr:hover { background:rgba(87,46,136,0.025); }
      .pp-table tbody td { padding:0.85rem 0.9rem; font-size:0.82rem; color:#1a1530; vertical-align:middle; }
      .pp-table tbody td.pp-col-num { color:rgba(26,21,48,0.6); font-weight:600; }
      .pp-table tbody td.pp-col-menu { text-align:right; padding-right:0.75rem; }
      .pp-show-cell { display:flex; align-items:center; gap:0.75rem; }
      .pp-show-thumb { width:44px; height:44px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:1rem; font-weight:900; color:#fff; }
      .pp-show-name { font-weight:800; color:#000; font-size:0.86rem; line-height:1.25; }
      .pp-show-sub { font-size:0.74rem; color:rgba(26,21,48,0.45); margin-top:0.1rem; }
      .pp-submitter-cell { display:flex; align-items:center; gap:0.6rem; }
      .pp-submitter-avatar { width:30px; height:30px; border-radius:50%; background:#efefef; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:900; color:#572e88; }
      .pp-submitter-name { font-weight:700; font-size:0.82rem; color:#1a1530; line-height:1.25; }
      .pp-submitter-role { font-size:0.72rem; color:rgba(26,21,48,0.45); }
      .pp-updated-date { font-size:0.82rem; color:#1a1530; }
      .pp-updated-by { font-size:0.72rem; color:rgba(26,21,48,0.45); margin-top:0.1rem; }
      .pp-empty-row { padding:2.5rem; text-align:center; color:rgba(26,21,48,0.4); font-size:0.88rem; }
      .pp-menu-btn { background:none; border:none; cursor:pointer; padding:0.3rem 0.5rem; border-radius:6px; color:rgba(26,21,48,0.4); font-size:1rem; font-weight:900; line-height:1; transition:background 0.12s,color 0.12s; }
      .pp-menu-btn:hover { background:rgba(87,46,136,0.08); color:#572e88; }

      /* ---- row overflow dropdown ---- */
      .pp-row-menu { position:fixed; background:#fff; border:1px solid rgba(87,46,136,0.14); border-radius:10px; box-shadow:0 8px 28px rgba(26,21,48,0.14); z-index:3100; min-width:160px; padding:0.3rem 0; }
      .pp-row-menu-item { display:block; width:100%; text-align:left; padding:0.55rem 1rem; font-family:var(--bts-font); font-size:0.83rem; color:#1a1530; font-weight:600; background:none; border:none; cursor:pointer; transition:background 0.1s; }
      .pp-row-menu-item:hover { background:rgba(87,46,136,0.06); }
      .pp-row-menu-item.danger { color:#d1523d; }
      .pp-row-menu-sep { height:1px; background:rgba(87,46,136,0.08); margin:0.25rem 0; }

      /* ---- status pill ---- */
      .opp-status-pill { display:inline-flex; align-items:center; border-radius:999px; padding:0.28rem 0.65rem; font-size:0.72rem; font-weight:800; white-space:nowrap; }

      /* ---- about card ---- */
      .pp-about-card { background:rgba(87,46,136,0.04); border:1px solid rgba(87,46,136,0.1); border-radius:14px; padding:1.5rem 1.75rem; display:grid; grid-template-columns:1fr auto; gap:2rem; align-items:start; }
      .pp-about-left { display:flex; gap:1rem; align-items:flex-start; }
      .pp-about-icon { width:44px; height:44px; border-radius:50%; background:#572e88; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:0.1rem; }
      .pp-about-icon img { width:22px; height:22px; filter:brightness(0) invert(1); }
      .pp-about-title { font-size:1rem; font-weight:900; color:#000; margin-bottom:0.4rem; }
      .pp-about-copy { font-size:0.84rem; color:rgba(26,21,48,0.6); line-height:1.6; }
      .pp-next-steps-title { font-size:0.88rem; font-weight:900; color:#000; margin-bottom:0.6rem; }
      .pp-next-steps { display:flex; flex-direction:column; gap:0.35rem; }
      .pp-next-step { font-size:0.82rem; color:rgba(26,21,48,0.65); display:flex; gap:0.5rem; }
      .pp-next-step-num { font-weight:800; color:#572e88; flex-shrink:0; }
      .pp-learn-more { display:inline-flex; align-items:center; gap:0.3rem; margin-top:0.9rem; font-size:0.82rem; font-weight:800; color:#572e88; text-decoration:none; cursor:pointer; background:none; border:none; font-family:var(--bts-font); padding:0; }

      /* ---- detail modal (existing) ---- */
      .opp-compare-panel { overflow:auto; background:#fff; border:1px solid rgba(87,46,136,0.12); border-radius:16px; }
      .opp-panel-head { padding:1rem 1.1rem; border-bottom:1px solid rgba(87,46,136,0.08); display:flex; align-items:center; justify-content:space-between; gap:0.75rem; }
      .opp-panel-title { font-size:0.92rem; font-weight:900; color:#1a1530; }
      .opp-panel-copy { font-size:0.78rem; color:#7d6f97; margin-top:0.2rem; }
      .opp-compare-grid { display:grid; grid-template-columns:180px repeat(var(--opp-compare-count,2), minmax(200px,1fr)); min-width:640px; }
      .opp-compare-cell { padding:0.8rem 0.9rem; border-bottom:1px solid rgba(87,46,136,0.08); border-right:1px solid rgba(87,46,136,0.08); font-size:0.82rem; color:#4b3d62; background:#fff; }
      .opp-compare-cell.label { font-weight:800; color:#1a1530; background:#faf8ff; }
      .opp-compare-cell.head { background:#f6f1ff; font-weight:900; color:#1a1530; }
      .opp-modal-overlay { display:none; position:fixed; inset:0; background:rgba(26,21,48,0.55); z-index:3200; padding:1rem; align-items:center; justify-content:center; }
      .opp-modal-overlay.open { display:flex; }
      .opp-modal { width:min(1080px,100%); max-height:92vh; overflow:auto; background:#fff; border-radius:18px; box-shadow:0 30px 80px rgba(26,21,48,0.28); }
      .opp-modal.intake-modal-shell { width:min(560px,100%); }
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
      @media (max-width:900px) {
        .pp-stat-row { grid-template-columns:repeat(2,1fr); }
        .pp-intake-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .pp-season-overview { grid-template-columns:1fr; }
        .pp-about-card { grid-template-columns:1fr; }
        .pp-table thead th:nth-child(n+5):nth-child(-n+8) { display:none; }
        .pp-table tbody td:nth-child(n+5):nth-child(-n+8) { display:none; }
      }
      @media (max-width:760px) {
        .opp-form-grid, .opp-form-grid.three, .opp-section-grid, .opp-level-row { grid-template-columns:1fr; }
        .pp-stat-row { grid-template-columns:1fr 1fr; }
        .pp-intake-grid { grid-template-columns:1fr; }
        .pp-page-actions .btn-primary { width:100%; justify-content:center; }
      }

      /* ---- season card tiles ---- */
      .pp-intake-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .pp-season-card { background:#fff; border:1px solid rgba(87,46,136,0.12); border-radius:16px; padding:1rem 1.1rem 0.75rem; display:flex; flex-direction:column; gap:0; box-shadow:0 2px 12px rgba(26,21,48,0.06); position:relative; overflow:hidden; cursor:pointer; transition:border-color 0.15s,box-shadow 0.15s; }
      .pp-season-card--active { border-color:#572e88; box-shadow:0 4px 20px rgba(87,46,136,0.14); background:rgba(87,46,136,0.02); }
      .pp-season-card--year { background:rgba(87,46,136,0.025); }
      .pp-season-card--year.pp-season-card--active { border-color:#572e88; }
      .pp-sc-deco { position:absolute; top:0.6rem; right:0.9rem; width:88px; height:88px; opacity:0.11; pointer-events:none; object-fit:contain; }
      .pp-sc-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.55rem; }
      .opp-status-pill { text-transform:uppercase; letter-spacing:0.05em; }
      .pp-sc-menu-btn { background:none; border:none; cursor:pointer; padding:0.2rem 0.4rem; border-radius:6px; color:rgba(26,21,48,0.35); font-size:1.05rem; line-height:1; font-weight:900; transition:background 0.12s,color 0.12s; }
      .pp-sc-menu-btn:hover { background:rgba(87,46,136,0.07); color:#572e88; }
      .pp-sc-year { font-size:0.78rem; font-weight:700; color:rgba(26,21,48,0.45); line-height:1; margin-bottom:0.18rem; }
      .pp-sc-title { font-size:1.75rem; font-weight:950; color:#1a1530; line-height:1; margin-bottom:0.85rem; max-width:75%; }
      .pp-sc-info-row { display:flex; border-top:1px solid rgba(87,46,136,0.08); border-bottom:1px solid rgba(87,46,136,0.08); padding:0.65rem 0; margin-bottom:0.7rem; }
      .pp-sc-info-cell { flex:1; display:flex; align-items:flex-start; gap:0.38rem; padding:0 0.5rem; min-width:0; }
      .pp-sc-info-cell:first-child { padding-left:0; }
      .pp-sc-info-cell:last-child { padding-right:0; }
      .pp-sc-info-cell + .pp-sc-info-cell { border-left:1px solid rgba(87,46,136,0.08); }
      .pp-sc-info-icon { width:14px; height:14px; opacity:0.38; flex-shrink:0; margin-top:1px; }
      .pp-sc-info-body { display:flex; flex-direction:column; gap:0.18rem; min-width:0; }
      .pp-sc-info-label { font-size:0.62rem; font-weight:800; color:rgba(26,21,48,0.4); text-transform:uppercase; letter-spacing:0.04em; line-height:1; }
      .pp-sc-info-value { font-size:0.8rem; font-weight:800; color:#1a1530; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .pp-sc-info-value--link { color:#572e88; cursor:pointer; }
      .pp-sc-footer { display:flex; align-items:center; }
      .pp-sc-action { flex:1; display:flex; align-items:center; justify-content:center; gap:0.3rem; padding:0.45rem 0.3rem; font-family:var(--bts-font); font-size:0.74rem; font-weight:800; color:rgba(26,21,48,0.5); background:none; border:none; cursor:pointer; border-radius:8px; transition:background 0.12s,color 0.12s; white-space:nowrap; }
      .pp-sc-action:hover { background:rgba(87,46,136,0.06); color:#572e88; }
      .pp-sc-action--primary { color:#572e88; font-weight:900; }
      .pp-sc-action-icon { width:13px; height:13px; opacity:0.7; flex-shrink:0; }
      .pp-sc-divider { width:1px; height:16px; background:rgba(87,46,136,0.12); flex-shrink:0; }

      /* ---- sub-season panel ---- */
      .pp-sub-intake-panel { background:rgba(87,46,136,0.03); border:1px solid rgba(87,46,136,0.1); border-radius:14px; padding:1rem; display:grid; gap:0.75rem; }
      .pp-sub-intake-header { display:flex; align-items:center; justify-content:space-between; gap:0.75rem; }
      .pp-sub-intake-year-name { font-size:0.88rem; font-weight:900; color:#1a1530; }
      .pp-sub-intake-empty { font-size:0.84rem; color:#8f84a5; padding:0.5rem 0; }
    `;
    document.head.appendChild(style);
  }

  function ensureModalShell() {
    if (!document.getElementById('proposal-form-modal')) {
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
                  <div class="form-group"><label class="form-label">Season</label><select class="form-select" id="pp-intake"></select></div>
                  <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="pp-status">${Object.entries(STATUS_META).map(([key, meta]) => `<option value="${key}">${esc(meta.label)}</option>`).join('')}</select></div>
                  <div class="form-group"><label class="form-label">Proposed Show Title</label><input class="form-input" id="pp-title" type="text" /></div>
                  <div class="form-group"><label class="form-label">Show Version</label><input class="form-input" id="pp-version" type="text" /></div>
                  <div class="form-group"><label class="form-label">Licensing Company</label><input class="form-input" id="pp-licensing" type="text" /></div>
                  <div class="form-group"><label class="form-label">Estimated Licensing Fee</label><input class="form-input" id="pp-fee" type="number" min="0" step="0.01" /></div>
                  <div class="form-group"><label class="form-label">Pitch Submitted By</label><input class="form-input" id="pp-submitted-by" type="text" /></div>
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

    if (!document.getElementById('proposal-intake-modal')) {
      const intakeWrap = document.createElement('div');
      intakeWrap.innerHTML = `
        <div class="opp-modal-overlay" id="proposal-intake-modal">
          <div class="opp-modal intake-modal-shell">
            <div class="opp-modal-head">
              <div>
                <div class="opp-panel-title" id="proposal-intake-modal-title">Add Year</div>
                <div class="opp-panel-copy" id="proposal-intake-modal-sub">Group projects under a year to keep everything organised.</div>
              </div>
              <button type="button" class="btn-secondary" onclick="closeProposalIntakeModal()">Close</button>
            </div>
            <div class="opp-modal-body">
              <input type="hidden" id="ppi-parent-id" />
              <div id="proposal-intake-form-error" class="form-error-msg"></div>
              <div class="opp-form-section">
                <h3 id="ppi-section-head">Year Setup</h3>
                <div class="opp-form-grid">
                  <div class="form-group"><label class="form-label" id="ppi-title-label">Year</label><input class="form-input" id="ppi-title" type="text" placeholder="2027" /></div>
                  <div class="form-group opp-form-span-2"><label class="form-label">Description</label><textarea class="form-textarea" id="ppi-description" placeholder="Tell people what kind of shows you want pitched this year."></textarea></div>
                </div>
              </div>
              <div class="opp-form-section" id="ppi-project-section">
                <h3>Project Setup</h3>
                <div class="opp-form-grid">
                  <div class="form-group"><label class="form-label">Season Passcode</label><input class="form-input" id="ppi-access-code" type="text" readonly style="background:rgba(26,21,48,0.04);color:rgba(26,21,48,0.5);cursor:default;" /></div>
                  <div class="form-group"><label class="form-label">Pitch Closes</label><input class="form-input" id="ppi-closes-at" type="datetime-local" /></div>
                  <div class="form-group"><label class="form-label">Accepting Pitches?</label><select class="form-select" id="ppi-is-open"><option value="yes">Yes</option><option value="no">No</option></select></div>
                </div>
              </div>
              <div class="opp-form-section" id="ppi-criteria-section">
                <h3>What We're Looking For</h3>
                <div class="opp-form-grid">
                  <div class="form-group">
                    <label class="form-label">Production Type</label>
                    <select class="form-select" id="ppi-production-type">
                      <option value="">No preference</option>
                      <option value="Musical">Musical</option>
                      <option value="Play">Play</option>
                      <option value="Workshop">Workshop</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Performer Age</label>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                      <input class="form-input" id="ppi-min-age" type="number" min="0" max="99" placeholder="Min" style="width:80px;" />
                      <span style="font-size:0.8rem;color:rgba(26,21,48,0.4);flex-shrink:0;">to</span>
                      <input class="form-input" id="ppi-max-age" type="number" min="0" max="99" placeholder="Max" style="width:80px;" />
                    </div>
                    <div style="font-size:0.65rem;color:rgba(26,21,48,0.4);margin-top:0.3rem;">Leave blank if no minimum or maximum.</div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Ideal Cast Size</label>
                    <select class="form-select" id="ppi-cast-size">
                      <option value="">No preference</option>
                      <option value="Small Cast (1–10)">Small Cast (1–10)</option>
                      <option value="Medium Cast (11–20)">Medium Cast (11–20)</option>
                      <option value="Large Cast (21–35)">Large Cast (21–35)</option>
                      <option value="Extra Large Cast (36+)">Extra Large Cast (36+)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="opp-form-actions">
                <button type="button" class="btn-secondary" onclick="closeProposalIntakeModal()">Cancel</button>
                <button type="button" class="btn-primary" id="ppi-save-btn" onclick="saveProposalIntakeForm()">Save Year</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(intakeWrap.firstElementChild);
      document.getElementById('proposal-intake-modal').addEventListener('click', function (event) {
        if (event.target === event.currentTarget) closeProposalIntakeModal();
      });
    }
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

  function proposalIntakeById(id) {
    return state.intakes.find(item => item.id === id) || null;
  }

  function topLevelIntakes() {
    return state.intakes.filter(function(i) { return !i.parent_id; });
  }

  function subIntakesOf(parentId) {
    return state.intakes.filter(function(i) { return i.parent_id === parentId; });
  }

  function intakeIsYear(intake) {
    return intake && !intake.parent_id;
  }

  function proposalIntakeStatus(intake) {
    if (!intake) return 'closed';
    if (!intake.is_open) return 'closed';
    if (intake.closes_at && new Date(intake.closes_at) < new Date()) return 'expired';
    return 'open';
  }

  function proposalIntakeStatusPill(intake) {
    const key = proposalIntakeStatus(intake);
    const meta = INTAKE_STATUS_META[key] || INTAKE_STATUS_META.closed;
    return `<span class="opp-status-pill" style="color:${meta.color};background:${meta.bg};">${esc(meta.label)}</span>`;
  }

  function fmtDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function generateAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = 'BTS-';
    for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function isMissingProposalIntakesSchema(error) {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('production_proposal_intakes') && (msg.includes('could not find the table') || msg.includes('schema cache'));
  }

  function renderProposalSetupRequired(message) {
    const root = proposalRoot();
    if (!root) return;
    root.innerHTML = `
      <div class="opp-shell">
        <div class="pp-intake-empty" style="max-width:760px;">
          <div style="font-weight:900;color:#1a1530;font-size:1.1rem;margin-bottom:0.45rem;">Production Proposals needs one SQL step first.</div>
          <div style="font-size:0.9rem;line-height:1.65;color:#6a5a80;margin-bottom:0.9rem;">The database in this environment does not have the <code>production_proposal_intakes</code> table yet, so seasons cannot load until that migration is run.</div>
          <div style="font-size:0.82rem;line-height:1.55;color:#8f84a5;">${esc(message || 'Missing production proposal intake schema.')}</div>
        </div>
      </div>`;
  }

  async function loadProductionProposalIntakes() {
    const { data, error } = await sb().from('production_proposal_intakes')
      .select('*')
      .eq('organization_id', currentOrg().id)
      .order('season_label', { ascending: false, nullsFirst: false });
    if (error) throw error;
    state.intakes = (data || []).sort(function(a, b) {
      var ya = parseInt(a.season_label, 10) || 0;
      var yb = parseInt(b.season_label, 10) || 0;
      return yb - ya;
    });
    const topLevel = topLevelIntakes();
    if (state.selectedIntakeId === 'all' && topLevel.length) state.selectedIntakeId = topLevel[0].id;
    if (state.selectedIntakeId !== 'all' && !proposalIntakeById(state.selectedIntakeId)) state.selectedIntakeId = topLevel[0]?.id || 'all';
    if (state.expandedYearId && !proposalIntakeById(state.expandedYearId)) state.expandedYearId = null;
  }

  async function loadProductionProposalsTab() {
    if (state.loading || !currentOrg()) return;
    state.loading = true;
    injectStyles();
    ensureModalShell();
    try {
      await ensureProposalFolder();
      await loadProductionProposalIntakes();
      const { data, error } = await sb().from('production_proposals')
        .select('*, production_proposal_intakes(id, title, season_label, is_open, closes_at)')
        .eq('organization_id', currentOrg().id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      state.proposals = (data || []).sort(proposalSort);
      if (!state.selectedProposalId || !proposalById(state.selectedProposalId)) {
        state.selectedProposalId = state.proposals[0]?.id || '';
      }
      if (state.selectedProposalId) await loadProposalAttachments(state.selectedProposalId);
      renderProposalsTab();
      if (!state.queryIntentHandled) {
        const proposalIntent = proposalIntentFromUrl();
        if (proposalIntent) {
          state.queryIntentHandled = true;
          if (proposalIntent === 'new') {
            openProposalModal();
          } else if (proposalById(proposalIntent)) {
            state.selectedProposalId = proposalIntent;
            if (!state.attachmentsByProposal[proposalIntent]) await loadProposalAttachments(proposalIntent);
            renderProposalsTab();
            openProposalModal(proposalIntent);
          }
          clearProposalIntentFromUrl();
        }
      }
      state.loaded = true;
    } catch (error) {
      console.error('[BTS] load proposals failed', error);
      if (isMissingProposalIntakesSchema(error)) {
        renderProposalSetupRequired(error.message || 'Missing production proposal intake schema.');
      } else if (proposalRoot()) {
        proposalRoot().innerHTML = `<div class="empty-state"><h3>Could not load proposals</h3><p>${esc(error.message || 'Unknown error')}</p></div>`;
      }
      showToast('Could not load production proposals.', true);
    } finally {
      state.loading = false;
    }
  }

  function proposalsForIntake(intakeId) {
    if (!intakeId || intakeId === 'all') return state.proposals;
    const sel = proposalIntakeById(intakeId);
    if (sel && intakeIsYear(sel)) {
      const subIds = subIntakesOf(sel.id).map(function(s) { return s.id; });
      return state.proposals.filter(function(p) { return subIds.includes(p.intake_id); });
    }
    return state.proposals.filter(function(p) { return p.intake_id === intakeId; });
  }

  function filteredProposals() {
    let list = proposalsForIntake(state.selectedIntakeId);
    if (state.filterStatus !== 'all') list = list.filter(item => item.status === state.filterStatus);
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(item =>
        (item.proposed_show_title || '').toLowerCase().includes(q) ||
        (item.licensing_company || '').toLowerCase().includes(q) ||
        (item.pitch_submitted_by || '').toLowerCase().includes(q) ||
        (proposalIntakeById(item.intake_id)?.title || item.production_proposal_intakes?.title || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function setProposalSearch(q) {
    state.searchQuery = q || '';
    renderProposalsTab();
  }

  function thumbColour(title) {
    const COLOURS = ['#572e88','#d1523d','#769e7b','#dd8233','#476aaa','#ca7ea7','#efab45','#78bbd4'];
    let hash = 0;
    for (let i = 0; i < (title || 'A').length; i++) hash = ((hash << 5) - hash) + (title || 'A').charCodeAt(i);
    return COLOURS[Math.abs(hash) % COLOURS.length];
  }

  function initialsOf(name) {
    return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  function renderStatCard(label, value, sub, iconBg) {
    return `
      <div class="pp-stat-card">
        <div class="pp-stat-icon" style="background:${iconBg};">
          <img src="/ASSETS/Images/Icons/Files.svg?v=20260705" alt="" aria-hidden="true" />
        </div>
        <div class="pp-stat-body">
          <div class="pp-stat-label">${esc(label)}</div>
          <div class="pp-stat-value">${esc(String(value))}</div>
          <div class="pp-stat-sub">${esc(sub)}</div>
        </div>
      </div>`;
  }

  function renderProposalRow(proposal) {
    const thumb = thumbColour(proposal.proposed_show_title);
    const letter = (proposal.proposed_show_title || 'P')[0].toUpperCase();
    const submitterInitials = initialsOf(proposal.pitch_submitted_by);
    const licensor = proposal.licensing_company || proposal.show_version || '';
    const intake = proposalIntakeById(proposal.intake_id) || proposal.production_proposal_intakes || null;
    return `
      <tr onclick="openProposalModal('${proposal.id}')">
        <td>${intake ? `<div class="pp-show-name" style="font-size:0.8rem;">${esc(intake.title || 'Season')}</div><div class="pp-show-sub">${esc(intake.season_label || '')}</div>` : '<span style="color:rgba(26,21,48,0.4);">—</span>'}</td>
        <td>
          <div class="pp-show-cell">
            <div class="pp-show-thumb" style="background:${thumb};">${esc(letter)}</div>
            <div>
              <div class="pp-show-name">${esc(proposal.proposed_show_title || 'Untitled Proposal')}</div>
              ${licensor ? `<div class="pp-show-sub">${esc(licensor)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>
          <div class="pp-submitter-cell">
            <div class="pp-submitter-avatar">${esc(submitterInitials)}</div>
            <div>
              <div class="pp-submitter-name">${esc(proposal.pitch_submitted_by || 'Unknown')}</div>
              ${proposal.genre_type ? `<div class="pp-submitter-role">${esc(proposal.genre_type)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${esc(fmtDateTime(proposal.submitted_at || proposal.created_at))}</td>
        <td>${statusPill(proposal.status)}</td>
        <td class="pp-col-num">${esc(fmtRuntime(proposal.runtime_minutes))}</td>
        <td class="pp-col-num">${esc(proposal.number_of_songs != null ? String(proposal.number_of_songs) : '--')}</td>
        <td class="pp-col-num">${esc(proposal.named_roles != null ? String(proposal.named_roles) : '--')}</td>
        <td class="pp-col-num">${esc(fmtCurrency(proposal.estimated_licensing_fee))}</td>
        <td>
          <div class="pp-updated-date">${esc(fmtDateTime(proposal.updated_at))}</div>
          ${proposal.pitch_submitted_by ? `<div class="pp-updated-by">by ${esc((proposal.pitch_submitted_by || '').split(' ').map((w, i) => i === 0 ? w : w[0] + '.').join(' '))}</div>` : ''}
        </td>
        <td class="pp-col-menu" onclick="event.stopPropagation()">
          <button class="pp-menu-btn" onclick="showProposalRowMenu(event,'${proposal.id}')" aria-label="More options">&#8943;</button>
        </td>
      </tr>`;
  }

  function showProposalRowMenu(event, proposalId) {
    const proposal = proposalById(proposalId);
    const intake = proposalIntakeById(proposal?.intake_id) || proposal?.production_proposal_intakes || null;
    document.getElementById('pp-row-menu')?.remove();
    const btn = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'pp-row-menu';
    menu.className = 'pp-row-menu';
    menu.innerHTML = `
      <button class="pp-row-menu-item" onclick="openProposalModal('${proposalId}');document.getElementById('pp-row-menu')?.remove()">Edit Proposal</button>
      ${intake ? `<button class="pp-row-menu-item" onclick="copyProposalIntakeInvite('${intake.id}');document.getElementById('pp-row-menu')?.remove()">Copy Intake Invite</button>` : ''}
      <div class="pp-row-menu-sep"></div>
      <button class="pp-row-menu-item" onclick="approveAndBuildProposal('${proposalId}');document.getElementById('pp-row-menu')?.remove()">Approve &amp; Build</button>
      <button class="pp-row-menu-item danger" onclick="archiveProposal('${proposalId}');document.getElementById('pp-row-menu')?.remove()">Archive</button>
    `;
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    document.body.appendChild(menu);
    setTimeout(function() {
      document.addEventListener('click', function dismiss(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', dismiss); }
      });
    }, 0);
  }

  function renderIntakeMeta(label, value) {
    return `<div class="pp-intake-meta-item"><strong>${esc(label)}</strong>${esc(value || '—')}</div>`;
  }

  function renderIntakeCode(label, value) {
    return `<div class="pp-intake-meta-item"><strong>${esc(label)}</strong><span class="pp-intake-meta-code">${esc(value || '—')}</span></div>`;
  }

  function shareInviteText(intake, url) {
    return `${intake.title}\n${url}\nPasscode: ${intake.access_code}`;
  }

  function renderSeasonOverview(intake) {
    if (!intake) {
      return `
        <div class="pp-season-overview is-all">
          <div>
            <div class="pp-season-kicker">Season Overview</div>
            <div class="pp-season-title">All Seasons</div>
            <div class="pp-season-copy">Choose a season card above to see the proposal totals, status counts, and pitch activity for that specific season.</div>
          </div>
          <div class="pp-season-actions">
            <button class="btn-primary" onclick="openProposalIntakeModal()">+ Add Season</button>
          </div>
        </div>`;
    }
    const status = proposalIntakeStatus(intake);
    const submissionCount = state.proposals.filter(function(item) { return item.intake_id === intake.id; }).length;
    return `
      <div class="pp-season-overview">
        <div>
          <div class="pp-season-kicker">Selected Season</div>
          <div class="pp-season-title">${esc(intake.title || 'Season')}</div>
          <div class="pp-season-copy">${esc(intake.description || 'This is the pitch intake for this season. Share it with your community, collect proposals here, and review them before building a production.')}</div>
          <div class="pp-season-meta">
            <div class="pp-season-chip">${esc(status.charAt(0).toUpperCase() + status.slice(1))}</div>
            <div class="pp-season-chip">${esc(intake.season_label || 'Season label not set')}</div>
            <div class="pp-season-chip">${esc(String(submissionCount))} proposals</div>
            <div class="pp-season-chip">${esc(intake.closes_at ? 'Closes ' + fmtDateTime(intake.closes_at) : 'No close date')}</div>
          </div>
        </div>
        <div class="pp-season-actions">
          <button class="btn-secondary" onclick="copyProposalIntakeInvite('${intake.id}')">Copy Invite</button>
          <button class="btn-secondary" onclick="openProposalIntakeShareTab('${intake.id}')">Open Pitch Page</button>
          <button class="btn-secondary" onclick="openProposalIntakeModal('${intake.id}')">Edit Season</button>
        </div>
      </div>`;
  }

  var INTAKE_TILE_PALETTE = [
    '#572e88','#769e7b','#d1523d','#476aaa','#dd8233','#ca7ea7','#78bbd4','#efab45'
  ];
  var INTAKE_TILE_ICONS = [
    'Auditions.svg','Star.svg','script-music-songs.svg','Characters.svg',
    'Rehearsals.svg','Performer.svg','Producer.svg','Choreography.svg'
  ];

  function renderIntakeCard(intake, tileIndex) {
    const active = intake.id === state.selectedIntakeId;
    const idx = typeof tileIndex === 'number' ? tileIndex : 0;
    const decoIcon = '/ASSETS/Images/Icons/' + INTAKE_TILE_ICONS[idx % INTAKE_TILE_ICONS.length];
    const sid = intake.id;
    const statusKey = proposalIntakeStatus(intake);
    const statusMeta = INTAKE_STATUS_META[statusKey] || INTAKE_STATUS_META.closed;
    const statusPill = '<span class="opp-status-pill" style="color:' + statusMeta.color + ';background:' + statusMeta.bg + ';">' + esc(statusMeta.label) + '</span>';

    // ── Year tile ──────────────────────────────────────────
    if (intakeIsYear(intake)) {
      const subs = subIntakesOf(sid);
      const totalPitches = proposalsForIntake(sid).length;
      const isExpanded = state.expandedYearId === sid;
      const closeDates = subs.map(function(s) { return s.closes_at ? new Date(s.closes_at) : null; }).filter(Boolean);
      const earliestClose = closeDates.length ? new Date(Math.min.apply(null, closeDates)) : null;
      const infoRow =
        '<div class="pp-sc-info-row">' +
          '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/Auditions.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">Projects</div><div class="pp-sc-info-value">' + esc(String(subs.length)) + '</div></div></div>' +
          '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/Applications.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">Proposals</div><div class="pp-sc-info-value">' + esc(String(totalPitches)) + '</div></div></div>' +
          '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/calendar-date.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">First Close</div><div class="pp-sc-info-value">' + esc(earliestClose ? fmtDateTime(earliestClose.toISOString()) : 'Not set') + '</div></div></div>' +
        '</div>';
      const footer =
        '<div class="pp-sc-footer">' +
          '<button class="pp-sc-action" onclick="event.stopPropagation();openProposalIntakeModal(\'' + sid + '\')"><img class="pp-sc-action-icon" src="/ASSETS/Images/Icons/edit-pencil.svg" alt="">Edit</button>' +
          '<div class="pp-sc-divider"></div>' +
          '<button class="pp-sc-action pp-sc-action--primary" onclick="event.stopPropagation();toggleExpandYear(\'' + sid + '\')">' + (isExpanded ? 'Collapse' : 'Projects') + '</button>' +
        '</div>';
      return '<div class="pp-season-card pp-season-card--year' + (isExpanded ? ' pp-season-card--active' : '') + '" onclick="toggleExpandYear(\'' + sid + '\')">' +
        '<img class="pp-sc-deco" src="' + esc(decoIcon) + '" alt="">' +
        '<div class="pp-sc-top">' + statusPill + '<button class="pp-sc-menu-btn" onclick="event.stopPropagation();openProposalIntakeModal(\'' + sid + '\')">&#8942;</button></div>' +
        '<div class="pp-sc-year">Year</div>' +
        '<div class="pp-sc-title">' + esc(intake.title || intake.season_label || 'Year') + '</div>' +
        infoRow + footer + '</div>';
    }

    // ── Project tile ───────────────────────────────────────
    const submissionCount = state.proposals.filter(function(item) { return item.intake_id === sid; }).length;
    const closesVal = intake.closes_at ? esc(fmtDateTime(intake.closes_at)) : 'Not set';
    const publicPageLabel = statusKey === 'open' ? 'View' : 'Preview';
    const infoRow =
      '<div class="pp-sc-info-row">' +
        '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/calendar-date.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">Closes</div><div class="pp-sc-info-value">' + closesVal + '</div></div></div>' +
        '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/Applications.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">Proposals</div><div class="pp-sc-info-value">' + esc(String(submissionCount)) + '</div></div></div>' +
        '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/visible.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">Public Page</div><div class="pp-sc-info-value pp-sc-info-value--link" onclick="event.stopPropagation();openProposalIntakeShareTab(\'' + sid + '\')">' + publicPageLabel + '</div></div></div>' +
      '</div>';
    const footer =
      '<div class="pp-sc-footer">' +
        '<button class="pp-sc-action" onclick="event.stopPropagation();openProposalIntakeModal(\'' + sid + '\')"><img class="pp-sc-action-icon" src="/ASSETS/Images/Icons/edit-pencil.svg" alt="">Edit</button>' +
        '<div class="pp-sc-divider"></div>' +
        '<button class="pp-sc-action" onclick="event.stopPropagation();copyProposalIntakeInvite(\'' + sid + '\')">Copy Invite</button>' +
        '<div class="pp-sc-divider"></div>' +
        '<button class="pp-sc-action pp-sc-action--primary" onclick="event.stopPropagation();setProposalIntakeFilter(\'' + sid + '\')">View Season</button>' +
      '</div>';
    return '<div class="pp-season-card' + (active ? ' pp-season-card--active' : '') + '" onclick="setProposalIntakeFilter(\'' + sid + '\')">' +
      '<img class="pp-sc-deco" src="' + esc(decoIcon) + '" alt="">' +
      '<div class="pp-sc-top">' + statusPill + '<button class="pp-sc-menu-btn" onclick="event.stopPropagation();openProposalIntakeModal(\'' + sid + '\')">&#8942;</button></div>' +
      '<div class="pp-sc-year">' + esc(intake.season_label || '') + '</div>' +
      '<div class="pp-sc-title">' + esc(intake.title || 'Project') + '</div>' +
      infoRow + footer + '</div>';
  }

  function renderProposalsTab() {
    const root = proposalRoot();
    if (!root) return;
    const hasSeasons = state.intakes.length > 0;
    const proposals = filteredProposals();
    const selectedIntake = state.selectedIntakeId === 'all' ? null : proposalIntakeById(state.selectedIntakeId);
    const statPool = proposalsForIntake(state.selectedIntakeId);
    const total = statPool.length;
    const underReviewCt = statPool.filter(function(p) { return p.status === 'under_review'; }).length;
    const shortlistedCt = statPool.filter(function(p) { return p.status === 'shortlisted'; }).length;
    const selectedCt = statPool.filter(function(p) { return p.status === 'selected'; }).length;
    const archivedCt = statPool.filter(function(p) { return p.status === 'archived'; }).length;
    const statSubtitle = selectedIntake
      ? (selectedIntake.season_label || selectedIntake.title || 'Selected season')
      : 'All seasons combined';
    const statEmptyAction = `
      <div class="pp-intake-empty">
        <div style="font-weight:800;color:#1a1530;margin-bottom:0.45rem;">No seasons yet.</div>
        <div style="margin-bottom:0.9rem;">Add a season first, then share its unique pitch link and passcode.</div>
        <button class="btn-primary" onclick="openProposalIntakeModal()">+ Add Season</button>
      </div>`;

    const statusOptions = Object.keys(STATUS_META).map(function(key) {
      return '<option value="' + key + '"' + (state.filterStatus === key ? ' selected' : '') + '>' + esc(STATUS_META[key].label) + '</option>';
    }).join('');
    const intakeOptions = ['<option value="all">All</option>'].concat(
      topLevelIntakes().map(function(year) {
        const subs = subIntakesOf(year.id);
        const yearOpt = `<option value="${year.id}"${state.selectedIntakeId === year.id ? ' selected' : ''}>${esc(year.title || year.season_label || 'Year')} (all)</option>`;
        const subOpts = subs.map(function(s) {
          return `<option value="${s.id}"${state.selectedIntakeId === s.id ? ' selected' : ''}>&nbsp;&nbsp;${esc(s.title)}</option>`;
        }).join('');
        return yearOpt + subOpts;
      })
    ).join('');

    root.innerHTML = `
      <div class="opp-shell">
        <div class="pp-page-actions" style="justify-content:flex-end;">
          <button class="btn-primary" onclick="openProposalIntakeModal()">+ Add Year</button>
        </div>

        <div class="pp-intake-panel">
          <div>
          ${topLevelIntakes().length
            ? `<div class="pp-intake-grid">${topLevelIntakes().map(function(intake, i) { return renderIntakeCard(intake, i); }).join('')}</div>`
            : statEmptyAction}
          ${state.expandedYearId ? (function() {
              const subs = subIntakesOf(state.expandedYearId);
              const yearIntake = proposalIntakeById(state.expandedYearId);
              return '<div class="pp-sub-intake-panel">' +
                '<div class="pp-sub-intake-header">' +
                  '<div class="pp-sub-intake-year-name">' + esc((yearIntake && yearIntake.title) || 'Year') + ' Projects</div>' +
                  '<button class="btn-secondary" style="font-size:0.8rem;padding:0.45rem 0.9rem;" onclick="openProposalIntakeModal(null,\'' + state.expandedYearId + '\')">+ Add Project</button>' +
                '</div>' +
                (subs.length
                  ? '<div class="pp-intake-grid">' + subs.map(function(s, i) { return renderIntakeCard(s, i); }).join('') + '</div>'
                  : '<div class="pp-sub-intake-empty">No projects yet. Add one to get started.</div>'
                ) +
                '</div>';
            })() : ''}
        </div>

        ${hasSeasons ? renderSeasonOverview(selectedIntake) : ''}

        ${hasSeasons ? `
        <div class="pp-stat-row">
          ${renderStatCard('Total Proposals', total, statSubtitle, 'rgba(87,46,136,0.12)')}
          ${renderStatCard('Under Review', underReviewCt, selectedIntake ? 'Inside this season' : 'Across all seasons', 'rgba(239,171,69,0.2)')}
          ${renderStatCard('Shortlisted', shortlistedCt, selectedIntake ? 'Inside this season' : 'Across all seasons', 'rgba(120,187,212,0.2)')}
          ${renderStatCard('Selected', selectedCt, selectedIntake ? 'Inside this season' : 'Across all seasons', 'rgba(118,158,123,0.2)')}
          ${renderStatCard('Archived', archivedCt, selectedIntake ? 'Inside this season' : 'Across all seasons', 'rgba(90,99,112,0.12)')}
        </div>

        <div class="pp-toolbar">
          <div class="pp-search-wrap">
            <img src="/ASSETS/Images/Icons/Search.svg?v=20260705" class="pp-search-icon" alt="" aria-hidden="true" />
            <input class="pp-search" type="search" placeholder="Search proposals..." value="${esc(state.searchQuery)}" oninput="setProposalSearch(this.value)" />
          </div>
          <div class="pp-toolbar-divider"></div>
          <select class="pp-filter-select" onchange="setProposalStatusFilter(this.value)">
            <option value="all"${state.filterStatus === 'all' ? ' selected' : ''}>All Statuses</option>
            ${statusOptions}
          </select>
          <select class="pp-filter-select" onchange="setProposalIntakeFilter(this.value)">
            ${intakeOptions}
          </select>
          ${selectedIntake ? `<button class="pp-filter-btn" onclick="copyProposalIntakeInvite('${selectedIntake.id}')">Copy Invite</button>` : ''}
        </div>

        <div class="pp-table-wrap">
          <table class="pp-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Show</th>
                <th>Submitted By</th>
                <th>Date Submitted</th>
                <th>Status</th>
                <th>Runtime</th>
                <th>Songs</th>
                <th>Roles</th>
                <th>Est. Rights Fee</th>
                <th>Last Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${proposals.length
                ? proposals.map(renderProposalRow).join('')
                : '<tr><td colspan="11" class="pp-empty-row">No proposals match your search. Try a different filter or share an active pitch season.</td></tr>'}
            </tbody>
          </table>
        </div>

        ${renderComparePanel()}
        ` : ''}
      </div>
    `;
  }

  function setProposalStatusFilter(value) {
    state.filterStatus = value || 'all';
    renderProposalsTab();
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
    const intake = proposalIntakeById(proposal.intake_id) || proposal.production_proposal_intakes || null;
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
          ${intake ? `<button class="btn-secondary" onclick="copyProposalIntakeInvite('${intake.id}')">Copy Intake Invite</button>` : ''}
          <button class="btn-secondary" onclick="archiveProposal('${proposal.id}')">Archive Proposal</button>
          <button class="btn-primary" onclick="approveAndBuildProposal('${proposal.id}')">Approve &amp; Build</button>
        </div>
        <div class="opp-section-grid">
          <div class="opp-kv"><div class="opp-kv-label">Season</div><div class="opp-kv-value">${esc(intake?.title || '—')}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Season Label</div><div class="opp-kv-value">${esc(intake?.season_label || '—')}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Submitted By</div><div class="opp-kv-value">${esc(proposal.pitch_submitted_by || '—')}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Submitter Email</div><div class="opp-kv-value">${esc(proposal.submitter_email || '—')}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Date Submitted</div><div class="opp-kv-value">${esc(fmtDateTime(proposal.submitted_at || proposal.created_at))}</div></div>
          <div class="opp-kv"><div class="opp-kv-label">Submitter Phone</div><div class="opp-kv-value">${esc(proposal.submitter_phone || '—')}</div></div>
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

  function renderProposalIntakeOptions(selectedId) {
    const select = document.getElementById('pp-intake');
    if (!select) return;
    const options = ['<option value="">No season pitch</option>'].concat(
      state.intakes.map(intake => `<option value="${intake.id}"${selectedId === intake.id ? ' selected' : ''}>${esc(intake.title)}</option>`)
    );
    select.innerHTML = options.join('');
  }

  function formProposalData() {
    return {
      intake_id: document.getElementById('pp-intake').value || null,
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
    renderProposalIntakeOptions(proposal?.intake_id || (state.selectedIntakeId !== 'all' ? state.selectedIntakeId : ''));
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

  function buildProposalShareUrl(intake) {
    const intakeKey = intake?.id || '';
    const token = intake?.access_token || '';
    if (!intakeKey || !token) return '';
    const url = new URL('/SYSTEM/Public/production-proposal.html', window.location.origin);
    url.searchParams.set('intake', intakeKey);
    url.searchParams.set('token', token);
    return url.toString();
  }

  function generateProposalToken() {
    if (window.crypto?.getRandomValues) {
      const bytes = new Uint8Array(12);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  }

  function selectedIntakeOrThrow(intakeId) {
    const intake = proposalIntakeById(intakeId || state.selectedIntakeId);
    if (!intake) throw new Error('Add a season first.');
    return intake;
  }

  function openProposalIntakeModal(id, parentId) {
    ensureModalShell();
    const intake = id ? proposalIntakeById(id) : null;
    const resolvedParentId = parentId || intake?.parent_id || '';
    const isProject = !!(resolvedParentId || (intake && intake.parent_id));
    const modal = document.getElementById('proposal-intake-modal');
    modal.dataset.intakeId = id || '';
    modal.dataset.parentId = resolvedParentId;

    // Show/hide sections
    document.getElementById('ppi-project-section').style.display = isProject ? '' : 'none';
    document.getElementById('ppi-criteria-section').style.display = isProject ? '' : 'none';

    // Labels and titles
    document.getElementById('proposal-intake-modal-title').textContent = intake
      ? (isProject ? 'Edit Project' : 'Edit Year')
      : (isProject ? 'Add Project' : 'Add Year');
    document.getElementById('proposal-intake-modal-sub').textContent = isProject
      ? 'Set up a project with its own pitch link, passcode, and criteria.'
      : 'Group projects under a year to keep everything organised.';
    document.getElementById('ppi-section-head').textContent = isProject ? 'Project Setup' : 'Year Setup';
    document.getElementById('ppi-title-label').textContent = isProject ? 'Project Name' : 'Year';
    document.getElementById('ppi-save-btn').textContent = intake
      ? (isProject ? 'Save Project' : 'Save Year')
      : (isProject ? 'Create Project' : 'Create Year');

    // Placeholder
    document.getElementById('ppi-title').placeholder = isProject ? 'Kids, Youth, Workshop...' : '2027';

    document.getElementById('proposal-intake-form-error').classList.remove('visible');
    document.getElementById('proposal-intake-form-error').textContent = '';
    document.getElementById('ppi-parent-id').value = resolvedParentId;
    document.getElementById('ppi-title').value = intake?.title || '';
    document.getElementById('ppi-description').value = intake?.description || '';

    if (isProject) {
      document.getElementById('ppi-access-code').value = intake?.access_code || generateAccessCode();
      document.getElementById('ppi-closes-at').value = fmtDateTimeInput(intake?.closes_at || '');
      document.getElementById('ppi-is-open').value = intake?.is_open === false ? 'no' : 'yes';
      document.getElementById('ppi-production-type').value = intake?.production_type || '';
      document.getElementById('ppi-min-age').value = intake?.min_performer_age ?? '';
      document.getElementById('ppi-max-age').value = intake?.max_performer_age ?? '';
      document.getElementById('ppi-cast-size').value = intake?.cast_size || '';
    }
    modal.classList.add('open');
  }

  function closeProposalIntakeModal() {
    document.getElementById('proposal-intake-modal')?.classList.remove('open');
  }

  async function saveProposalIntakeForm() {
    const modal = document.getElementById('proposal-intake-modal');
    const intakeId = modal?.dataset?.intakeId || '';
    const parentId = modal?.dataset?.parentId || '';
    const isProject = !!parentId || !!(intakeId && proposalIntakeById(intakeId)?.parent_id);
    const errorEl = document.getElementById('proposal-intake-form-error');
    const title = document.getElementById('ppi-title').value.trim();
    const parentIntake = parentId ? proposalIntakeById(parentId) : null;
    const seasonLabel = isProject
      ? (parentIntake?.season_label || parentIntake?.title || null)
      : (title || null);
    const payload = {
      organization_id: currentOrg().id,
      title: title,
      season_label: seasonLabel,
      description: document.getElementById('ppi-description').value.trim() || null,
      parent_id: isProject ? (parentId || proposalIntakeById(intakeId)?.parent_id || null) : null,
      closes_at: isProject && document.getElementById('ppi-closes-at').value ? new Date(document.getElementById('ppi-closes-at').value).toISOString() : null,
      is_open: isProject ? document.getElementById('ppi-is-open').value === 'yes' : true,
      production_type: isProject ? (document.getElementById('ppi-production-type').value || null) : null,
      min_performer_age: isProject && document.getElementById('ppi-min-age').value !== '' ? parseInt(document.getElementById('ppi-min-age').value, 10) : null,
      max_performer_age: isProject && document.getElementById('ppi-max-age').value !== '' ? parseInt(document.getElementById('ppi-max-age').value, 10) : null,
      cast_size: isProject ? (document.getElementById('ppi-cast-size').value || null) : null,
    };
    if (!intakeId) {
      payload.access_code = isProject
        ? document.getElementById('ppi-access-code').value.trim()
        : generateProposalToken().slice(0, 8).toLowerCase();
    }
    if (!payload.title) {
      errorEl.textContent = isProject ? 'Project name is required.' : 'Year is required.';
      errorEl.classList.add('visible');
      return;
    }
    try {
      let saved;
      if (intakeId) {
        const { data, error } = await sb().from('production_proposal_intakes').update(payload).eq('id', intakeId).select().single();
        if (error) throw error;
        saved = data;
      } else {
        payload.created_by = currentUser()?.id || null;
        payload.access_token = generateProposalToken();
        const { data, error } = await sb().from('production_proposal_intakes').insert(payload).select().single();
        if (error) throw error;
        saved = data;
      }
      closeProposalIntakeModal();
      await loadProductionProposalIntakes();
      state.selectedIntakeId = saved.id;
      renderProposalsTab();
      showToast(intakeId ? (isProject ? 'Project updated.' : 'Year updated.') : (isProject ? 'Project created.' : 'Year created.'));
    } catch (error) {
      console.error('[BTS] save proposal intake failed', error);
      errorEl.textContent = error.message || 'Could not save season.';
      errorEl.classList.add('visible');
    }
  }

  function setProposalIntakeFilter(value) {
    state.selectedIntakeId = value || 'all';
    renderProposalsTab();
  }

  function toggleExpandYear(yearId) {
    state.expandedYearId = state.expandedYearId === yearId ? null : yearId;
    if (state.expandedYearId) state.selectedIntakeId = yearId;
    renderProposalsTab();
  }

  async function openProposalIntakeShareTab(intakeId) {
    const intake = selectedIntakeOrThrow(intakeId);
    const draftTab = window.open('', '_blank');
    if (draftTab) draftTab.opener = null;
    try {
      const url = buildProposalShareUrl(intake);
      if (!url) throw new Error('Could not build a share URL for this season.');
      if (draftTab) {
        draftTab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener');
      }
    } catch (error) {
      if (draftTab) draftTab.close();
      console.error('[BTS] open proposal intake page failed', error);
      showToast(error.message || 'Could not open the season pitch page.', true);
    }
  }

  function fallbackCopyText(value) {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }

  async function copyProposalIntakeInvite(intakeId) {
    try {
      const intake = selectedIntakeOrThrow(intakeId);
      const url = buildProposalShareUrl(intake);
      if (!url) throw new Error('Could not build a share URL for this season.');
      const message = shareInviteText(intake, url);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        fallbackCopyText(message);
      }
      showToast('Season invite copied.');
    } catch (error) {
      console.error('[BTS] copy proposal intake invite failed', error);
      showToast(error.message || 'Could not copy the season invite.', true);
    }
  }

  async function copyProposalIntakeUrl(intakeId) {
    try {
      const intake = selectedIntakeOrThrow(intakeId);
      const url = buildProposalShareUrl(intake);
      if (!url) throw new Error('Could not build a share URL for this season.');
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        fallbackCopyText(url);
      }
      showToast('Season link copied.');
    } catch (error) {
      console.error('[BTS] copy proposal intake url failed', error);
      showToast(error.message || 'Could not copy the season link.', true);
    }
  }

  function openNewProposalTab() {
    openProposalIntakeModal();
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

  async function approveAndBuildProposal(proposalId) {
    const proposal = proposalById(proposalId);
    if (!proposal) return;
    if (proposal.selected_production_id) {
      showToast('This proposal already created a production.', true);
      return;
    }
    if (!window.confirm(`Approve "${proposal.proposed_show_title}" and build a production from it?`)) return;
    try {
      if (proposal.status !== 'selected') {
        const { data, error } = await sb().from('production_proposals').update({
          status: 'selected',
          selected_at: new Date().toISOString(),
        }).eq('id', proposal.id).select().single();
        if (error) throw error;
        state.proposals = state.proposals.map(item => item.id === proposal.id ? data : item).sort(proposalSort);
      }
      await createProductionFromProposal(proposalId);
    } catch (error) {
      console.error('[BTS] approve and build failed', error);
      showToast(error.message || 'Could not approve and build this proposal.', true);
    }
  }

  window.setProposalSearch = setProposalSearch;
  window.showProposalRowMenu = showProposalRowMenu;
  window.loadProductionProposalsTab = loadProductionProposalsTab;
  window.openProposalModal = openProposalModal;
  window.closeProposalModal = closeProposalModal;
  window.openNewProposalTab = openNewProposalTab;
  window.openProposalIntakeModal = openProposalIntakeModal;
  window.toggleExpandYear = toggleExpandYear;
  window.closeProposalIntakeModal = closeProposalIntakeModal;
  window.saveProposalIntakeForm = saveProposalIntakeForm;
  window.setProposalIntakeFilter = setProposalIntakeFilter;
  window.openProposalIntakeShareTab = openProposalIntakeShareTab;
  window.copyProposalIntakeInvite = copyProposalIntakeInvite;
  window.copyProposalIntakeUrl = copyProposalIntakeUrl;
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
  window.approveAndBuildProposal = approveAndBuildProposal;
}());
