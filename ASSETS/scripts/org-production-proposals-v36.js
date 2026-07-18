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

  var currentFormConfig = null;

  var QUESTION_TYPES = [
    { value:'short_answer',      label:'Short Answer' },
    { value:'long_answer',       label:'Long Answer' },
    { value:'email',             label:'Email' },
    { value:'phone',             label:'Phone' },
    { value:'number',            label:'Number' },
    { value:'currency',          label:'Currency' },
    { value:'date',              label:'Date' },
    { value:'date_range',        label:'Date Range' },
    { value:'time',              label:'Time' },
    { value:'url',               label:'URL' },
    { value:'dropdown',          label:'Dropdown' },
    { value:'checkbox',          label:'Checkbox' },
    { value:'yes_no',            label:'Yes / No' },
    { value:'yes_no_unsure',     label:'Yes / No / Unsure' },
    { value:'rating',            label:'Rating (1–5)' },
    { value:'file_upload',       label:'File Upload' },
    { value:'info_text',         label:'Info Text' },
    { value:'divider',           label:'Divider' },
    { value:'agreement_checkbox',label:'Agreement Checkbox' },
    { value:'project_select',   label:'Project Select' },
  ];

  function mkQ(id, label, type, overrides) {
    return Object.assign({ id:id, label:label, type:type, required:false, enabled:true, help_text:'', placeholder:'', options:[], conditions:[], field_key:id }, overrides||{});
  }

  var DEFAULT_FORM_CONFIG = { sections: [
    { id:'sec_submitter', title:'Submitter Info', enabled:true, questions:[
      mkQ('si_name','Your name','short_answer',{required:true,field_key:'pitch_submitted_by'}),
      mkQ('si_email','Your email','email',{required:true,field_key:'submitter_email'}),
      mkQ('si_phone','Your phone number','phone',{field_key:'submitter_phone'}),
      mkQ('si_role','Your role / relationship to the organisation','dropdown',{options:['Director','Producer','Board member','Volunteer','Parent','Performer','Community member','Other']}),
      mkQ('si_worked_before','Have you worked with this organisation before?','yes_no'),
    ]},
    { id:'sec_show_basics', title:'Show Basics', enabled:true, questions:[
      mkQ('sb_project','Which project is this pitch for?','project_select',{required:true,field_key:'project_name'}),
      mkQ('sb_title','Show title','short_answer',{required:true,field_key:'proposed_show_title'}),
      mkQ('sb_cover','Show poster / cover image','file_upload'),
      mkQ('sb_version','Show version / edition','dropdown',{options:['Full','JR','Kid','Sr','Student','Young Performer','Other'],field_key:'show_version'}),
      mkQ('sb_author','Author / composer / playwright','short_answer'),
      mkQ('sb_licensing_co','Licensing company','dropdown',{options:['Musical Theatre International (MTI)','Concord Theatricals','Original Work','Other'],field_key:'licensing_company'}),
      mkQ('sb_licensing_link','Licensing link','url'),
      mkQ('sb_licensing_cost','Estimated licensing cost','currency',{field_key:'estimated_licensing_fee'}),
      mkQ('sb_runtime','Runtime (minutes)','number',{placeholder:'e.g. 135',field_key:'runtime_minutes'}),
      mkQ('sb_acts','Number of acts','number'),
      mkQ('sb_synopsis','Synopsis','long_answer',{field_key:'short_synopsis'}),
    ]},
    { id:'sec_why', title:'Why This Show?', enabled:true, questions:[
      mkQ('why_pitching','Why are you pitching this show?','long_answer'),
      mkQ('why_fit','Why is this show a good fit for this organisation?','long_answer',{field_key:'organization_fit'}),
      mkQ('why_now','Why is this the right time for this show?','long_answer'),
      mkQ('why_appeal','Why would audiences come see it?','long_answer'),
      mkQ('why_over_others','What makes this show worth choosing over other options?','long_answer'),
    ]},
    { id:'sec_casting', title:'Casting', enabled:true, questions:[
      mkQ('cast_named_roles','Named roles','number',{field_key:'named_roles'}),
      mkQ('cast_ensemble','Ensemble opportunities','number',{field_key:'ensemble_opportunities'}),
      mkQ('cast_featured_dancers','Featured dancers','number'),
      mkQ('cast_gender_flex','Gender flexibility','short_answer',{placeholder:'e.g. Flexible, Cross-gender welcome'}),
      mkQ('cast_notes','Casting notes','long_answer',{placeholder:'Any additional casting details, opportunities, or requirements.'}),
    ]},
    { id:'sec_music', title:'Music and Choreography', enabled:true, questions:[
      mkQ('mu_production_type','Type of production','dropdown',{required:true,options:['Musical','Play','Operetta','Revue','Cabaret','One-Act Play','Dance Show','Variety Show','Original Work','Other'],field_key:'production_type'}),
      mkQ('mu_songs','Number of songs','number',{field_key:'number_of_songs'}),
      mkQ('mu_vocal_diff','Vocal difficulty','rating'),
      mkQ('mu_dance_diff','Dance difficulty','rating'),
      mkQ('mu_music_diff','Music difficulty','rating'),
      mkQ('mu_dance_numbers','Are there major dance numbers?','yes_no'),
      mkQ('mu_music_style','Music style','long_answer',{placeholder:'Describe the style or feel of the music (e.g. Contemporary Broadway, Jazz, Pop, Folk).'}),
      mkQ('mu_key_numbers','Key musical numbers','long_answer',{placeholder:'List key songs or production numbers (optional).'}),
    ]},
    { id:'sec_content', title:'Content and Suitability', enabled:true, questions:[
      mkQ('cs_warnings','Content warnings','checkbox',{options:['Language','Violence','Alcohol','Drugs','Smoking','Death','Grief','Bullying','Mental health themes','Sexual references','Religious themes','Racism','Discrimination','Scary scenes','None known','Other'],field_key:'content_warnings'}),
      mkQ('why_audience','Who is the audience for this show?','checkbox',{options:['Families','Adults','Kids','Seniors','Schools']}),
      mkQ('cs_notes','Suitability notes','long_answer'),
    ]},
    { id:'sec_risks', title:'Risks and Challenges', enabled:true, questions:[
      mkQ('ri_challenge','What is the biggest challenge with producing this show?','long_answer'),
      mkQ('ri_difficult','What could make this show difficult for this organisation?','long_answer'),
      mkQ('ri_manage','How we will manage it','long_answer',{placeholder:'Describe how you plan to address these challenges.'}),
    ]},
    { id:'sec_attachments', title:'Attachments', enabled:true, questions:[
      mkQ('at_files','Supporting files','file_upload',{help_text:'Script sample, licensing quote, budget notes, mood board, poster, director résumé, etc.'}),
    ]},
  ]};

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
      .pp-table tbody td.pp-col-num { color:rgba(26,21,48,0.6); font-weight:700; }
      .pp-table tbody td.pp-col-menu { text-align:right; padding-right:0.75rem; }
      .pp-show-cell { display:flex; align-items:center; gap:0.75rem; }
      .pp-show-thumb { height:44px; width:44px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:1rem; font-weight:900; color:#fff; }
      .pp-show-thumb img { height:44px; width:auto; max-width:72px; border-radius:6px; object-fit:contain; display:block; background:#f0eff5; }
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
      .pp-row-menu-item { display:block; width:100%; text-align:left; padding:0.55rem 1rem; font-family:var(--bts-font); font-size:0.83rem; color:#1a1530; font-weight:700; background:none; border:none; cursor:pointer; transition:background 0.1s; }
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
      .opp-modal.intake-modal-shell { width:min(560px,96vw); max-height:94vh; }
      .opp-modal.intake-modal-shell.pfb-wide { width:min(1100px,96vw) !important; max-width:none !important; }
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
      .pp-season-card { background:#fff; border:2px solid transparent; border-radius:16px; padding:1rem 1.1rem 0.75rem; display:flex; flex-direction:column; gap:0; box-shadow:0 4px 18px rgba(26,21,48,0.18); position:relative; overflow:hidden; cursor:pointer; transition:filter 0.15s,box-shadow 0.15s; }
      .pp-season-card--active { box-shadow:0 6px 28px rgba(0,0,0,0.22); filter:brightness(1.06); border-color:rgba(255,255,255,0.35); }
      .pp-sc-deco { position:absolute; top:0.6rem; right:0.9rem; width:88px; height:88px; opacity:0.15; pointer-events:none; object-fit:contain; filter:brightness(0) invert(1); }
      .pp-sc-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.55rem; }
      .opp-status-pill { text-transform:uppercase; letter-spacing:0.05em; }
      .pp-sc-menu-btn { background:none; border:none; cursor:pointer; padding:0.2rem 0.4rem; border-radius:6px; color:rgba(255,255,255,0.6); font-size:1.05rem; line-height:1; font-weight:900; transition:background 0.12s,color 0.12s; }
      .pp-sc-menu-btn:hover { background:rgba(255,255,255,0.12); color:#fff; }
      .pp-sc-year { font-size:0.78rem; font-weight:700; color:rgba(255,255,255,0.65); line-height:1; margin-bottom:0.18rem; }
      .pp-sc-title { font-size:1.75rem; font-weight:900; color:#fff; line-height:1; margin-bottom:0.42rem; max-width:75%; }
      .pp-sc-passcode { display:flex; align-items:center; gap:0.4rem; font-size:0.72rem; font-weight:700; color:rgba(255,255,255,0.55); letter-spacing:0.06em; margin-bottom:0.7rem; }
      .pp-sc-passcode-copy { background:none; border:none; cursor:pointer; padding:0; display:flex; align-items:center; opacity:0.5; transition:opacity 0.15s; flex-shrink:0; }
      .pp-sc-passcode-copy:hover { opacity:1; }
      .pp-sc-passcode-copy img { width:13px; height:13px; filter:brightness(0) invert(1); }
      .pp-sc-info-row { display:flex; border-top:1px solid rgba(255,255,255,0.18); border-bottom:1px solid rgba(255,255,255,0.18); padding:0.65rem 0; margin-bottom:0.7rem; }
      .pp-sc-info-cell { flex:1; display:flex; align-items:stretch; gap:0.38rem; padding:0 0.5rem; min-width:0; }
      .pp-sc-info-cell:first-child { padding-left:0; }
      .pp-sc-info-cell:last-child { padding-right:0; }
      .pp-sc-info-cell + .pp-sc-info-cell { border-left:1px solid rgba(255,255,255,0.18); }
      .pp-sc-info-icon { width:auto; height:100%; opacity:0.7; flex-shrink:0; filter:brightness(0) invert(1); object-fit:contain; }
      .pp-sc-info-body { display:flex; flex-direction:column; gap:0.18rem; min-width:0; }
      .pp-sc-info-label { font-size:0.62rem; font-weight:800; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:0.04em; line-height:1; }
      .pp-sc-info-value { font-size:0.8rem; font-weight:800; color:#fff; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .pp-sc-info-value--link { color:#fff; cursor:pointer; text-decoration:underline; text-decoration-color:rgba(255,255,255,0.4); }
      .pp-sc-footer { display:flex; align-items:center; }
      .pp-sc-action { flex:1; display:flex; align-items:center; justify-content:center; gap:0.3rem; padding:0.45rem 0.3rem; font-family:var(--bts-font); font-size:0.74rem; font-weight:800; color:rgba(255,255,255,0.75); background:none; border:none; cursor:pointer; border-radius:8px; transition:background 0.12s,color 0.12s; white-space:nowrap; }
      .pp-sc-action:hover { background:rgba(255,255,255,0.12); color:#fff; }
      .pp-sc-action--primary { color:#fff; font-weight:900; }
      .pp-sc-action--danger { color:rgba(255,255,255,0.55); }
      .pp-sc-action--danger:hover { background:rgba(209,82,61,0.28); color:#fff; }
      .pp-sc-action-icon { width:13px; height:13px; opacity:0.75; flex-shrink:0; filter:brightness(0) invert(1); }
      .pp-sc-divider { width:1px; height:16px; background:rgba(255,255,255,0.2); flex-shrink:0; }

      /* ---- sub-season panel ---- */
      .pp-sub-intake-panel { background:rgba(87,46,136,0.03); border:1px solid rgba(87,46,136,0.1); border-radius:14px; padding:1rem; display:grid; gap:0.75rem; }
      .pp-sub-intake-header { display:flex; align-items:center; justify-content:space-between; gap:0.75rem; }
      .pp-sub-intake-year-name { font-size:0.88rem; font-weight:900; color:#1a1530; }
      .pp-sub-intake-empty { font-size:0.84rem; color:#8f84a5; padding:0.5rem 0; }

      /* ---- form builder (Step 3) ---- */
      .pfb-layout { display:flex; height:72vh; min-height:420px; border:1px solid rgba(87,46,136,0.13); border-radius:14px; overflow:hidden; }
      .pfb-sidebar { width:220px; }
      .pfb-sidebar { width:210px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid rgba(87,46,136,0.1); background:#faf9fc; overflow-y:auto; }
      .pfb-sidebar-item { display:flex; align-items:center; gap:0.45rem; padding:0.65rem 0.85rem; cursor:pointer; border-bottom:1px solid rgba(87,46,136,0.07); user-select:none; transition:background 0.12s; }
      .pfb-sidebar-item:hover { background:rgba(87,46,136,0.06); }
      .pfb-sidebar-item--active { background:rgba(87,46,136,0.11); border-left:3px solid #572e88; padding-left:calc(0.85rem - 3px); }
      .pfb-sidebar-item--active .pfb-sidebar-name { color:#572e88; }
      .pfb-sidebar-item--disabled { opacity:0.5; }
      .pfb-sidebar-name { flex:1; font-size:0.8rem; font-weight:700; color:#1a1530; line-height:1.3; }
      .pfb-sidebar-footer { margin-top:auto; padding:0.55rem; border-top:1px dashed rgba(87,46,136,0.15); }
      .pfb-sidebar-add-btn { width:100%; appearance:none; border:none; background:transparent; color:rgba(87,46,136,0.5); font:inherit; font-size:0.76rem; font-weight:700; padding:0.4rem 0.5rem; cursor:pointer; border-radius:8px; transition:background 0.12s,color 0.12s; }
      .pfb-sidebar-add-btn:hover { background:rgba(87,46,136,0.08); color:#572e88; }
      .pfb-main { flex:1; overflow-y:auto; background:#fff; }
      .pfb-main-head { display:flex; align-items:center; gap:0.5rem; padding:0.85rem 0.9rem 0.7rem; border-bottom:1px solid rgba(87,46,136,0.09); background:#fff; position:sticky; top:0; z-index:1; }
      .pfb-section-title-input { flex:1; min-width:80px; border:none; background:transparent; font:inherit; font-weight:800; font-size:0.98rem; color:#1a1530; outline:none; padding:0; }
      .pfb-section-title-input:focus { background:rgba(87,46,136,0.05); border-radius:4px; padding:0 4px; }
      .pfb-main-body { padding:0.7rem 0.9rem 1rem; display:flex; flex-direction:column; gap:0.3rem; }
      .pfb-q-count { font-size:0.62rem; font-weight:800; background:rgba(87,46,136,0.09); color:#572e88; border-radius:99px; padding:0.1rem 0.48rem; white-space:nowrap; flex-shrink:0; }
      .pfb-question { background:#fff; border:1px solid rgba(87,46,136,0.1); border-radius:8px; }
      .pfb-question--disabled { opacity:0.42; }
      .pfb-q-row { display:flex; align-items:center; gap:0.45rem; padding:0.48rem 0.6rem; }
      .pfb-q-move-btns { display:flex; flex-direction:column; gap:0; flex-shrink:0; }
      .pfb-q-label-input { flex:1; min-width:100px; border:none; background:transparent; font:inherit; font-size:0.85rem; font-weight:700; color:#1a1530; outline:none; padding:0; }
      .pfb-q-label-input:focus { background:rgba(87,46,136,0.05); border-radius:4px; padding:0 4px; }
      .pfb-q-type-pill { font-size:0.63rem; font-weight:800; background:rgba(87,46,136,0.09); color:#572e88; border-radius:6px; padding:0.13rem 0.42rem; white-space:nowrap; flex-shrink:0; letter-spacing:0.01em; }
      .pfb-q-req-pill { appearance:none; border:none; border-radius:99px; font:inherit; font-size:0.62rem; font-weight:900; letter-spacing:0.04em; text-transform:uppercase; padding:0.13rem 0.5rem; cursor:pointer; flex-shrink:0; transition:background 0.12s,color 0.12s; }
      .pfb-q-req-pill--required { background:#d1523d; color:#fff; }
      .pfb-q-req-pill--optional { background:rgba(87,46,136,0.09); color:rgba(87,46,136,0.5); }
      .pfb-q-btns { display:flex; align-items:center; gap:0.14rem; flex-shrink:0; }
      .pfb-q-settings { display:none; padding:0.6rem 0.7rem 0.65rem; border-top:1px solid rgba(87,46,136,0.08); background:rgba(87,46,136,0.02); flex-direction:column; gap:0.5rem; }
      .pfb-q--settings-open .pfb-q-settings { display:flex; }
      .pfb-q-settings-row { display:flex; gap:0.5rem; flex-wrap:wrap; }
      .pfb-q-settings-label { font-size:0.62rem; font-weight:900; text-transform:uppercase; letter-spacing:0.07em; color:rgba(87,46,136,0.5); margin-bottom:0.2rem; }
      .pfb-q-field-wrap { display:flex; flex-direction:column; flex:1; min-width:140px; }
      .pfb-q-type-sel { border:1px solid rgba(87,46,136,0.15); border-radius:6px; padding:0.26rem 0.42rem; font:inherit; font-size:0.8rem; color:#572e88; background:#fff; }
      .pfb-q-help-input,.pfb-q-placeholder-input,.pfb-q-option-input { border:1px solid rgba(87,46,136,0.14); border-radius:6px; padding:0.26rem 0.42rem; font:inherit; font-size:0.8rem; color:rgba(26,21,48,0.7); background:#fff; width:100%; box-sizing:border-box; }
      .pfb-q-req-lbl { font-size:0.76rem; font-weight:700; color:rgba(26,21,48,0.55); display:flex; align-items:center; gap:0.28rem; cursor:pointer; white-space:nowrap; padding-top:1.1rem; }
      .pfb-q-options-inline { padding:0.5rem 0.7rem 0.6rem; border-top:1px solid rgba(87,46,136,0.08); background:rgba(87,46,136,0.02); display:flex; flex-direction:column; gap:0.25rem; }
      .pfb-q-options { display:flex; flex-direction:column; gap:0.22rem; width:100%; }
      .pfb-q-options-label { font-size:0.62rem; font-weight:900; letter-spacing:0.07em; text-transform:uppercase; color:rgba(87,46,136,0.5); margin-bottom:0.1rem; }
      .pfb-q-option-row { display:flex; gap:0.3rem; align-items:center; }
      .pfb-btn { appearance:none; border:none; border-radius:6px; background:transparent; color:rgba(87,46,136,0.45); font:inherit; font-size:0.76rem; font-weight:700; padding:0.2rem 0.38rem; cursor:pointer; transition:background 0.12s,color 0.12s; line-height:1.2; }
      .pfb-btn:hover:not(:disabled) { background:rgba(87,46,136,0.1); color:#572e88; }
      .pfb-btn:disabled { opacity:0.2; cursor:not-allowed; }
      .pfb-btn--danger:hover:not(:disabled) { background:rgba(209,82,61,0.08); color:#d1523d; }
      .pfb-btn--gear { padding:0.15rem 0.28rem; }
      .pfb-btn--gear img { width:17px; height:17px; display:block; opacity:0.4; transition:opacity 0.12s; filter:brightness(0) saturate(100%) invert(16%) sepia(55%) saturate(800%) hue-rotate(240deg); }
      .pfb-btn--gear:hover img { opacity:1; }
      .pfb-add-q-btn { appearance:none; border:1px dashed rgba(87,46,136,0.2); border-radius:8px; background:transparent; color:rgba(87,46,136,0.5); font:inherit; font-size:0.76rem; font-weight:700; padding:0.38rem 0.7rem; cursor:pointer; width:100%; margin-top:0.1rem; transition:background 0.12s,color 0.12s; }
      .pfb-add-q-btn:hover { background:rgba(87,46,136,0.06); color:#572e88; }
      .pfb-toggle-small { position:relative; display:inline-flex; align-items:center; cursor:pointer; width:30px; height:17px; flex-shrink:0; }
      .pfb-toggle-small input { position:absolute; opacity:0; width:0; height:0; }
      .pfb-toggle-track { position:absolute; inset:0; border-radius:99px; background:rgba(87,46,136,0.15); transition:background 0.16s; }
      .pfb-toggle-small input:checked ~ .pfb-toggle-track { background:#572e88; }
      .pfb-toggle-thumb { position:absolute; width:11px; height:11px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.22); top:3px; left:3px; transition:transform 0.16s; pointer-events:none; }
      .pfb-toggle-small input:checked ~ .pfb-toggle-thumb { transform:translateX(13px); }

      /* ---- full-page pitch view overlay ---- */
      .ppv-overlay { display:none; position:fixed; inset:0; z-index:3600; background:rgba(26,21,48,0.55); align-items:center; justify-content:center; padding:2vh 2vw; }
      .ppv-overlay.open { display:flex; }
      .ppv-shell { width:100%; height:100%; max-width:1400px; background:#f0eff5; border-radius:18px; box-shadow:0 30px 80px rgba(26,21,48,0.3); display:flex; flex-direction:column; overflow:hidden; }
      .ppv-topbar { display:flex; align-items:center; gap:0.75rem; padding:0.8rem 1.25rem; background:#fff; border-bottom:1px solid rgba(87,46,136,0.1); flex-shrink:0; border-radius:18px 18px 0 0; }
      .ppv-topbar-org { font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:rgba(26,21,48,0.4); }
      .ppv-topbar-title { font-size:1rem; font-weight:900; color:#1a1530; flex:1; }
      .ppv-topbar-intake { font-size:0.78rem; font-weight:700; color:#572e88; }
      .ppv-body { display:flex; flex:1; overflow:hidden; border-radius:0 0 18px 18px; }
      .ppv-main { flex:1; overflow-y:auto; padding:2rem 2.5rem; background:#fff; }
      .ppv-scoring { width:320px; flex-shrink:0; border-left:1px solid rgba(87,46,136,0.1); background:#fff; overflow-y:auto; display:flex; flex-direction:column; }
      .ppv-scoring-head { padding:1rem 1.1rem 0.75rem; border-bottom:1px solid rgba(87,46,136,0.08); position:sticky; top:0; background:#fff; z-index:1; }
      .ppv-scoring-title { font-size:0.92rem; font-weight:900; color:#1a1530; }
      .ppv-scoring-sub { font-size:0.74rem; color:rgba(26,21,48,0.45); margin-top:0.2rem; }
      .ppv-scoring-body { padding:1rem 1.1rem; flex:1; display:flex; flex-direction:column; gap:0.75rem; }
      .ppv-score-placeholder { background:rgba(87,46,136,0.04); border:1px dashed rgba(87,46,136,0.18); border-radius:12px; padding:1.5rem 1rem; text-align:center; color:rgba(26,21,48,0.35); font-size:0.82rem; line-height:1.5; }
      /* pitch view cards */
      .ppv-top-row { display:grid; grid-template-columns:180px 1fr; gap:1rem; align-items:start; }
      .ppv-poster { width:100%; aspect-ratio:2/3; border-radius:14px; overflow:hidden; background:linear-gradient(135deg,#572e88,#476aaa); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.35); font-size:0.78rem; font-weight:700; letter-spacing:0.04em; }
      .ppv-poster img { width:100%; height:100%; object-fit:cover; display:block; }
      .ppv-card { border-radius:16px; padding:1.15rem 1.25rem; color:#fff; }
      .ppv-card-hd { display:flex; align-items:center; gap:0.55rem; margin-bottom:0.9rem; }
      .ppv-card-icon { width:22px; height:22px; flex-shrink:0; filter:brightness(0) invert(1); opacity:0.85; }
      .ppv-card-title { font-size:0.92rem; font-weight:900; letter-spacing:0.05em; text-transform:uppercase; }
      .ppv-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; }
      .ppv-grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.6rem; }
      .ppv-field { background:rgba(255,255,255,0.14); border-radius:10px; padding:0.6rem 0.75rem; }
      .ppv-field-lbl { font-size:0.62rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.55); margin-bottom:0.2rem; }
      .ppv-field-val { font-size:0.88rem; font-weight:700; color:#fff; line-height:1.35; }
      .ppv-field-val.empty { color:rgba(255,255,255,0.3); font-style:italic; font-weight:400; }
      .ppv-divider { border:none; border-top:1px dashed rgba(255,255,255,0.2); margin:0.85rem 0; }
      .ppv-synopsis { background:rgba(255,255,255,0.12); border-radius:10px; padding:0.75rem 0.85rem; font-size:0.84rem; color:rgba(255,255,255,0.9); line-height:1.6; white-space:pre-wrap; }
      .ppv-qa { margin-bottom:0.7rem; }
      .ppv-qa-lbl { font-size:0.62rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.5); margin-bottom:0.3rem; }
      .ppv-qa-val { font-size:0.84rem; color:rgba(255,255,255,0.9); line-height:1.55; white-space:pre-wrap; }
      .ppv-pill-row { display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.3rem; }
      .ppv-pill { background:rgba(255,255,255,0.2); border-radius:99px; padding:0.22rem 0.65rem; font-size:0.72rem; font-weight:700; color:#fff; }
      .ppv-rating-row { display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem; }
      .ppv-rating-box { background:rgba(255,255,255,0.14); border-radius:10px; padding:0.5rem 0.75rem; text-align:center; min-width:80px; }
      .ppv-rating-lbl { font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.5); margin-bottom:0.25rem; }
      .ppv-rating-stars { font-size:0.9rem; letter-spacing:0.05em; }
      .ppv-sections-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
      .ppv-full { grid-column:1/-1; }
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

    document.getElementById('proposal-intake-modal')?.remove();
    {
      const intakeWrap = document.createElement('div');
      intakeWrap.innerHTML = `
        <div class="opp-modal-overlay" id="proposal-intake-modal">
          <div class="opp-modal intake-modal-shell">
            <div class="opp-modal-head" style="padding-bottom:0.5rem;">
              <div class="opp-panel-title" id="proposal-intake-modal-title">Add Season</div>
              <button type="button" class="btn-secondary" onclick="closeProposalIntakeModal()">Close</button>
            </div>
            <div class="opp-modal-body" style="padding-top:0.5rem;">

              <!-- step pills -->
              <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;">
                <div id="ppi-step-pill-1" style="flex:1;height:3px;border-radius:99px;background:#572e88;transition:background 0.2s;"></div>
                <div id="ppi-step-pill-2" style="flex:1;height:3px;border-radius:99px;background:rgba(87,46,136,0.15);transition:background 0.2s;"></div>
                <div id="ppi-step-pill-3" style="flex:1;height:3px;border-radius:99px;background:rgba(87,46,136,0.15);transition:background 0.2s;"></div>
              </div>

              <div id="proposal-intake-form-error" class="form-error-msg"></div>

              <!-- step 1: season info -->
              <div id="ppi-step-1">
                <div style="display:flex;flex-direction:column;gap:1rem;margin-bottom:1.5rem;">
                  <div style="display:grid;grid-template-columns:1fr 110px;gap:1rem;">
                    <div class="form-group" style="margin:0;"><label class="form-label">Season Name</label><input class="form-input" id="ppi-title" type="text" placeholder="Summer, Fall, Spring..." /></div>
                    <div class="form-group" style="margin:0;"><label class="form-label">Year</label><input class="form-input" id="ppi-season-year" type="number" min="2000" max="2100" placeholder="2026" /></div>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:end;">
                    <div class="form-group" style="margin:0;"><label class="form-label">Pitch Closes</label><input class="form-input" id="ppi-closes-at" type="datetime-local" style="height:42px;" /></div>
                    <div class="form-group" style="margin:0;"><label class="form-label">Accepting Pitches?</label><select class="form-select" id="ppi-is-open" style="height:42px;"><option value="yes">Yes</option><option value="no">No</option></select></div>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Passcode <span style="font-weight:400;opacity:0.45;text-transform:none;letter-spacing:0;">(set at creation, cannot be changed)</span></label>
                    <input class="form-input" id="ppi-access-code" type="text" readonly style="height:42px;background:rgba(26,21,48,0.03);color:rgba(26,21,48,0.4);cursor:default;letter-spacing:0.06em;" />
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label class="form-label">Description <span style="font-weight:400;opacity:0.45;text-transform:none;letter-spacing:0;">(optional)</span></label>
                    <textarea class="form-textarea" id="ppi-description" placeholder="Tell pitchers what you're looking for this season." style="height:100px;resize:none;display:block;width:100%;box-sizing:border-box;"></textarea>
                  </div>
                </div>
                <div class="opp-form-actions" style="justify-content:space-between;">
                  <button type="button" id="ppi-delete-btn" class="btn-secondary" style="color:#d1523d;border-color:rgba(209,82,61,0.35);" onclick="proposalIntakeDelete()">Delete Season</button>
                  <div style="display:flex;gap:0.65rem;">
                    <button type="button" class="btn-secondary" onclick="closeProposalIntakeModal()">Cancel</button>
                    <button type="button" class="btn-primary" onclick="proposalIntakeNextStep()">Next: Projects</button>
                  </div>
                </div>
              </div>

              <!-- step 2: projects -->
              <div id="ppi-step-2" style="display:none;">
                <p style="font-size:0.84rem;color:rgba(26,21,48,0.45);margin:0 0 1.25rem;">List the projects pitchers can apply for. Leave this empty if the season accepts general pitches.</p>
                <div id="ppi-projects-list" style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:0.5rem;"></div>
                <div id="ppi-projects-empty" style="font-size:0.84rem;color:rgba(26,21,48,0.35);padding:0.25rem 0 1rem;">No projects yet.</div>
                <button type="button" class="btn-secondary" style="margin-bottom:1.5rem;" onclick="addProposalProject()">+ Add Project</button>
                <div class="opp-form-actions">
                  <button type="button" class="btn-secondary" onclick="proposalIntakePrevStep()">Back</button>
                  <button type="button" class="btn-primary" onclick="proposalIntakeNextStep()">Next: Form</button>
                </div>
              </div>

              <!-- step 3: form builder -->
              <div id="ppi-step-3" style="display:none;">
                <div class="pfb-layout" style="margin-bottom:1rem;">
                  <div id="ppi-fb-sidebar" class="pfb-sidebar"></div>
                  <div id="ppi-fb-main" class="pfb-main"></div>
                </div>
                <div class="opp-form-actions">
                  <button type="button" class="btn-secondary" onclick="proposalIntakePrevStep()">Back</button>
                  <button type="button" class="btn-primary" id="ppi-save-btn" onclick="saveProposalIntakeForm()">Save Season</button>
                </div>
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
      // Always include the intake itself — flat intakes have no children but proposals link directly to them
      return state.proposals.filter(function(p) { return p.intake_id === intakeId || subIds.includes(p.intake_id); });
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
    const posterUrl = proposal.form_answers && proposal.form_answers.sb_cover;
    const thumbHtml = posterUrl
      ? `<div class="pp-show-thumb" style="background:transparent;width:auto;"><img src="${esc(posterUrl)}" alt="" onerror="this.parentElement.innerHTML='${esc(letter)}';this.parentElement.style.background='${thumb}';this.parentElement.style.width='44px'"></div>`
      : `<div class="pp-show-thumb" style="background:${thumb};">${esc(letter)}</div>`;
    return `
      <tr onclick="openProposalView('${proposal.id}')">
        <td>${intake ? `<div class="pp-show-name" style="font-size:0.8rem;">${esc(intake.title || 'Season')}</div><div class="pp-show-sub">${esc(intake.season_label || '')}</div>` : '<span style="color:rgba(26,21,48,0.4);">—</span>'}</td>
        <td>
          <div class="pp-show-cell">
            ${thumbHtml}
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
    '#769e7b','#d1523d','#476aaa','#dd8233','#ca7ea7','#78bbd4','#efab45','#000000'
  ];
  var INTAKE_TILE_ICONS = [
    'Auditions.svg','Star.svg','script-music-songs.svg','Characters.svg',
    'Rehearsals.svg','Performer.svg','Producer.svg','Choreography.svg'
  ];

  function renderIntakeCard(intake, tileIndex) {
    const active = intake.id === state.selectedIntakeId;
    const idx = typeof tileIndex === 'number' ? tileIndex : 0;
    const tileColor = INTAKE_TILE_PALETTE[idx % INTAKE_TILE_PALETTE.length];
    const decoIcon = '/ASSETS/Images/Icons/' + INTAKE_TILE_ICONS[idx % INTAKE_TILE_ICONS.length];
    const sid = intake.id;
    const statusKey = proposalIntakeStatus(intake);
    const statusMeta = INTAKE_STATUS_META[statusKey] || INTAKE_STATUS_META.closed;
    const statusPill = '<span class="opp-status-pill" style="color:#fff;background:rgba(255,255,255,0.22);font-size:0.68rem;font-weight:800;padding:0.2rem 0.55rem;border-radius:99px;">' + esc(statusMeta.label) + '</span>';
    const submissionCount = state.proposals.filter(function(p) { return p.intake_id === sid; }).length;
    const closesVal = intake.closes_at ? esc(fmtDateTime(intake.closes_at)) : 'Not set';
    const projectCount = Array.isArray(intake.projects) ? intake.projects.length : 0;
    const infoRow =
      '<div class="pp-sc-info-row">' +
        '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/navproductioncalendar.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">Closes</div><div class="pp-sc-info-value">' + closesVal + '</div></div></div>' +
        '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/Applications.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">Proposals</div><div class="pp-sc-info-value">' + esc(String(submissionCount)) + '</div></div></div>' +
        '<div class="pp-sc-info-cell"><img class="pp-sc-info-icon" src="/ASSETS/Images/Icons/Characters.svg" alt=""><div class="pp-sc-info-body"><div class="pp-sc-info-label">Projects</div><div class="pp-sc-info-value">' + esc(String(projectCount)) + '</div></div></div>' +
      '</div>';
    const footer =
      '<div class="pp-sc-footer">' +
        '<button class="pp-sc-action" onclick="event.stopPropagation();openProposalIntakeModal(\'' + sid + '\')"><img class="pp-sc-action-icon" src="/ASSETS/Images/Icons/edit-pencil.svg" alt="">Edit</button>' +
        '<div class="pp-sc-divider"></div>' +
        '<button class="pp-sc-action" onclick="event.stopPropagation();copyProposalIntakeInvite(\'' + sid + '\')">Copy Invite</button>' +
        '<div class="pp-sc-divider"></div>' +
        '<button class="pp-sc-action" onclick="event.stopPropagation();openProposalIntakeShareTab(\'' + sid + '\')">View Page</button>' +
        '<div class="pp-sc-divider"></div>' +
        '<button class="pp-sc-action pp-sc-action--danger" onclick="event.stopPropagation();deleteProposalIntakeById(\'' + sid + '\')">Delete</button>' +
      '</div>';
    return '<div class="pp-season-card' + (active ? ' pp-season-card--active' : '') + '" style="background:' + tileColor + ';" onclick="setProposalIntakeFilter(\'' + sid + '\')">' +
      '<img class="pp-sc-deco" src="' + esc(decoIcon) + '" alt="">' +
      '<div class="pp-sc-top">' + statusPill + '</div>' +
      '<div class="pp-sc-year">' + esc(intake.season_label || '') + '</div>' +
      '<div class="pp-sc-title">' + esc(intake.title || 'Season') + '</div>' +
      (intake.access_code ? '<div class="pp-sc-passcode"><span>Passcode: ' + esc(intake.access_code) + '</span><button class="pp-sc-passcode-copy" onclick="event.stopPropagation();navigator.clipboard.writeText(\'' + esc(intake.access_code) + '\').then(function(){window.showToast&&showToast(\'Passcode copied.\');})" title="Copy passcode"><img src="/ASSETS/Images/Icons/copy.svg" alt="Copy"></button></div>' : '') +
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
    const intakeOptions = ['<option value="all">All Seasons</option>'].concat(
      state.intakes.map(function(intake) {
        const label = [intake.season_label, intake.title].filter(Boolean).join(' — ');
        return '<option value="' + intake.id + '"' + (state.selectedIntakeId === intake.id ? ' selected' : '') + '>' + esc(label) + '</option>';
      })
    ).join('');

    root.innerHTML = `
      <div class="opp-shell">
        <div class="pp-intake-panel">
          <div>
          ${state.intakes.length
            ? '<div class="pp-intake-grid">' + state.intakes.map(function(intake, i) { return renderIntakeCard(intake, i); }).join('') + '</div>'
            : statEmptyAction}
        </div>


        ${hasSeasons ? `
        <div class="pp-stat-row" style="grid-template-columns:repeat(3,minmax(0,1fr));">
          ${renderStatCard('Total Proposals', total, statSubtitle, 'rgba(87,46,136,0.12)')}
          ${renderStatCard('Shortlisted', shortlistedCt, selectedIntake ? 'Inside this season' : 'Across all seasons', 'rgba(120,187,212,0.2)')}
          ${renderStatCard('Selected', selectedCt, selectedIntake ? 'Inside this season' : 'Across all seasons', 'rgba(118,158,123,0.2)')}
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

  // ---- Pitch View (read-only full-page overlay) ----

  function injectPitchViewStyles() {
    if (document.getElementById('ppv-styles')) return;
    const s = document.createElement('style');
    s.id = 'ppv-styles';
    s.textContent = `
      .ppv-overlay { display:none; position:fixed; inset:0; z-index:3600; background:rgba(26,21,48,0.55); align-items:center; justify-content:center; padding:2vh 2vw; }
      .ppv-overlay.open { display:flex; }
      .ppv-shell { width:100%; height:100%; max-width:1400px; background:#f0eff5; border-radius:18px; box-shadow:0 30px 80px rgba(26,21,48,0.3); display:flex; flex-direction:column; overflow:hidden; }
      .ppv-topbar { display:flex; align-items:center; gap:0.75rem; padding:0.8rem 1.25rem; background:#fff; border-bottom:1px solid rgba(87,46,136,0.1); flex-shrink:0; border-radius:18px 18px 0 0; }
      .ppv-topbar-org { font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.07em; color:rgba(26,21,48,0.4); }
      .ppv-topbar-title { font-size:1rem; font-weight:900; color:#1a1530; }
      .ppv-topbar-intake { font-size:0.78rem; font-weight:700; color:#572e88; }
      .ppv-body { display:flex; flex:1; overflow:hidden; border-radius:0 0 18px 18px; }
      .ppv-main { flex:1; overflow-y:auto; padding:2rem 2.5rem; background:#fff; }
      .ppv-scoring { width:320px; flex-shrink:0; border-left:1px solid rgba(87,46,136,0.1); background:#fff; overflow-y:auto; display:flex; flex-direction:column; }
      .ppv-scoring-head { padding:1rem 1.1rem 0.75rem; border-bottom:1px solid rgba(87,46,136,0.08); position:sticky; top:0; background:#fff; z-index:1; }
      .ppv-scoring-title { font-size:0.92rem; font-weight:900; color:#1a1530; }
      .ppv-scoring-sub { font-size:0.74rem; color:rgba(26,21,48,0.45); margin-top:0.2rem; }
      .ppv-scoring-body { padding:1rem 1.1rem; flex:1; display:flex; flex-direction:column; gap:0.75rem; }
      .ppv-score-placeholder { background:rgba(87,46,136,0.04); border:1px dashed rgba(87,46,136,0.18); border-radius:12px; padding:1.5rem 1rem; text-align:center; color:rgba(26,21,48,0.35); font-size:0.82rem; line-height:1.5; }
      .ppv-top-row { display:grid; grid-template-columns:180px 1fr; gap:1rem; align-items:start; }
      .ppv-poster { width:100%; aspect-ratio:2/3; border-radius:14px; overflow:hidden; background:linear-gradient(135deg,#572e88,#476aaa); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.35); font-size:0.78rem; font-weight:700; }
      .ppv-poster img { width:100%; height:100%; object-fit:cover; display:block; }
      .ppv-card { border-radius:16px; padding:1.15rem 1.25rem; color:#fff; }
      .ppv-card-hd { display:flex; align-items:center; gap:0.55rem; margin-bottom:0.9rem; }
      .ppv-card-icon { width:22px; height:22px; flex-shrink:0; filter:brightness(0) invert(1); opacity:0.85; }
      .ppv-card-title { font-size:0.92rem; font-weight:900; letter-spacing:0.05em; text-transform:uppercase; }
      .ppv-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; }
      .ppv-grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.6rem; }
      .ppv-field { background:rgba(255,255,255,0.14); border-radius:10px; padding:0.6rem 0.75rem; }
      .ppv-field-lbl { font-size:0.62rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.55); margin-bottom:0.2rem; }
      .ppv-field-val { font-size:0.88rem; font-weight:700; color:#fff; line-height:1.35; }
      .ppv-field-val.empty { color:rgba(255,255,255,0.3); font-style:italic; font-weight:400; }
      .ppv-divider { border:none; border-top:1px dashed rgba(255,255,255,0.2); margin:0.85rem 0; }
      .ppv-synopsis { background:rgba(255,255,255,0.12); border-radius:10px; padding:0.75rem 0.85rem; font-size:0.84rem; color:rgba(255,255,255,0.9); line-height:1.6; white-space:pre-wrap; }
      .ppv-qa { margin-bottom:0.7rem; }
      .ppv-qa-lbl { font-size:0.62rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.5); margin-bottom:0.3rem; }
      .ppv-qa-val { font-size:0.84rem; color:rgba(255,255,255,0.9); line-height:1.55; white-space:pre-wrap; }
      .ppv-pill-row { display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.3rem; }
      .ppv-pill { background:rgba(255,255,255,0.2); border-radius:99px; padding:0.22rem 0.65rem; font-size:0.72rem; font-weight:700; color:#fff; }
      .ppv-rating-row { display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem; }
      .ppv-rating-box { background:rgba(255,255,255,0.14); border-radius:10px; padding:0.5rem 0.75rem; text-align:center; min-width:80px; }
      .ppv-rating-lbl { font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.5); margin-bottom:0.25rem; }
      .ppv-rating-stars { font-size:0.9rem; letter-spacing:0.05em; }
      .ppv-sections-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
      .ppv-full { grid-column:1/-1; }
      .ppv-review-section { display:flex; flex-direction:column; gap:0.45rem; }
      .ppv-review-label { font-size:0.74rem; font-weight:700; color:rgba(26,21,48,0.5); display:flex; align-items:center; gap:0.3rem; }
      .ppv-label-icon { width:14px; height:14px; flex-shrink:0; }
      .ppv-review-tags { display:flex; flex-wrap:wrap; gap:0.25rem; min-height:4px; }
      .ppv-review-tag { display:inline-flex; align-items:center; gap:0.3rem; border-radius:99px; padding:0.26rem 0.55rem 0.26rem 0.45rem; font-size:0.7rem; font-weight:700; line-height:1.2; }
      .ppv-review-tag.love { background:#769e7b; color:#fff; }
      .ppv-review-tag.challenge { background:#efab45; color:#1a1530; }
      .ppv-review-tag-icon { width:13px; height:13px; flex-shrink:0; }
      .ppv-review-tag-x { background:none; border:none; cursor:pointer; color:inherit; opacity:0.55; font-size:0.95rem; line-height:1; padding:0; font-weight:900; font-family:inherit; }
      .ppv-review-tag-x:hover { opacity:1; }
      .ppv-review-add-row { display:flex; gap:0.35rem; margin-top:0.2rem; }
      .ppv-review-add-input { flex:1; border:1.5px solid rgba(26,21,48,0.12); border-radius:8px; padding:0.35rem 0.55rem; font-size:0.76rem; font-family:inherit; outline:none; color:#1a1530; background:#fff; min-width:0; }
      .ppv-review-add-input:focus { border-color:#572e88; }
      .ppv-review-add-btn { background:#572e88; color:#fff; border:none; border-radius:8px; padding:0.35rem 0.7rem; font-size:0.72rem; font-weight:800; cursor:pointer; font-family:inherit; white-space:nowrap; }
      .ppv-review-add-btn:hover { background:#3d2066; }
      .ppv-review-notes { width:100%; min-height:72px; border:1.5px solid rgba(26,21,48,0.12); border-radius:10px; padding:0.55rem 0.7rem; font-size:0.78rem; color:#1a1530; resize:vertical; font-family:inherit; outline:none; transition:border-color 0.14s; box-sizing:border-box; }
      .ppv-review-notes:focus { border-color:#572e88; }
      .ppv-save-row { display:flex; justify-content:flex-end; padding-top:0.1rem; }
      .ppv-save-status { font-size:0.7rem; color:rgba(26,21,48,0.3); font-weight:700; transition:opacity 0.2s; }
      .ppvl-layout { display:flex; gap:2rem; align-items:flex-start; }
      .ppvl-sidebar { width:190px; flex-shrink:0; display:flex; flex-direction:column; gap:1.25rem; }
      .ppvl-poster { border-radius:14px; overflow:hidden; background:#1a1530; }
      .ppvl-poster img { width:100%; display:block; }
      .ppvl-poster-fallback { aspect-ratio:2/3; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#572e88,#476aaa); color:rgba(255,255,255,0.35); font-size:2.5rem; font-weight:900; }
      .ppvl-basics { display:flex; flex-direction:column; gap:0.75rem; }
      .ppvl-basics-title { font-size:0.7rem; font-weight:700; color:rgba(26,21,48,0.35); margin-bottom:0.1rem; }
      .ppvl-content-label { font-size:0.72rem; font-weight:700; color:rgba(26,21,48,0.4); margin-bottom:0.2rem; }
      .ppvl-basic-item { display:flex; align-items:center; gap:0.55rem; }
      .ppvl-basic-icon { width:18px; height:18px; flex-shrink:0; opacity:0.28; }
      .ppvl-basic-value { font-size:0.9rem; font-weight:900; color:#1a1530; line-height:1.1; }
      .ppvl-basic-label { font-size:0.68rem; font-weight:400; color:rgba(26,21,48,0.38); }
      .ppvl-content { flex:1; min-width:0; display:flex; flex-direction:column; gap:1.5rem; overflow-wrap:break-word; }
      .ppvl-kicker { font-size:0.72rem; font-weight:700; color:rgba(26,21,48,0.35); margin-bottom:0.1rem; }
      .ppvl-title { font-size:2.1rem; font-weight:900; color:#1a1530; line-height:1.05; letter-spacing:-0.01em; word-break:break-word; }
      .ppvl-genre { font-size:0.84rem; font-weight:700; color:rgba(26,21,48,0.45); margin-top:0.25rem; font-style:italic; }
      .ppvl-logline { font-size:0.97rem; font-weight:700; color:#1a1530; line-height:1.65; margin:0; }
      .ppvl-synopsis { font-size:0.86rem; color:rgba(26,21,48,0.65); line-height:1.85; white-space:pre-wrap; overflow-wrap:break-word; }
      .ppvl-review-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
      .ppvl-review-col { border-radius:14px; overflow:hidden; }
      .ppvl-review-col-head { padding:0.65rem 1rem; display:flex; align-items:center; gap:0.4rem; }
      .ppvl-review-col-head.love { background:#769e7b; }
      .ppvl-review-col-head.challenge { background:#dd8233; }
      .ppvl-review-col-title { font-size:0.8rem; font-weight:900; color:#fff; }
      .ppvl-review-col-icon { width:14px; height:14px; filter:brightness(0) invert(1); opacity:0.9; }
      .ppvl-review-col-body { background:rgba(26,21,48,0.03); padding:0.75rem 1rem; }
      .ppvl-review-list { display:flex; flex-direction:column; gap:0.45rem; }
      .ppvl-review-list-item { display:flex; align-items:flex-start; gap:0.4rem; font-size:0.83rem; color:#1a1530; line-height:1.45; }
      .ppvl-review-list-icon { width:15px; height:15px; flex-shrink:0; margin-top:0.1rem; }
      .ppvl-footer-fields { display:flex; gap:2rem; flex-wrap:wrap; border-top:1px solid rgba(26,21,48,0.08); padding-top:1.25rem; }
      .ppvl-footer-field { display:flex; flex-direction:column; gap:0.25rem; }
      .ppvl-footer-lbl { font-size:0.7rem; font-weight:400; color:rgba(26,21,48,0.38); }
      .ppvl-footer-val { font-size:0.83rem; font-weight:700; color:#1a1530; overflow-wrap:break-word; word-break:break-all; }
      .ppvl-footer-val.empty { color:rgba(26,21,48,0.28); font-style:italic; }
      .ppvl-details { display:flex; flex-direction:column; gap:1rem; border-top:1px solid rgba(26,21,48,0.08); padding-top:1.5rem; margin-top:0.25rem; }
      .ppvl-detail-section { border-radius:14px; overflow:hidden; }
      .ppvl-detail-section-head { padding:0.75rem 1.1rem; display:flex; align-items:center; gap:0.5rem; }
      .ppvl-detail-section-icon { width:16px; height:16px; filter:brightness(0) invert(1); opacity:0.9; }
      .ppvl-detail-section-title { font-size:0.86rem; font-weight:900; color:#fff; }
      .ppvl-detail-section-body { background:#fff; border:1px solid rgba(26,21,48,0.07); border-top:none; border-radius:0 0 14px 14px; padding:1.1rem 1.2rem; display:flex; flex-direction:column; gap:0.75rem; }
      .ppvl-detail-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:0.75rem; }
      .ppvl-detail-field { display:flex; flex-direction:column; gap:0.2rem; }
      .ppvl-detail-field-lbl { font-size:0.7rem; font-weight:400; color:rgba(26,21,48,0.4); }
      .ppvl-detail-field-val { font-size:0.86rem; font-weight:700; color:#1a1530; }
      .ppvl-detail-qa { display:flex; flex-direction:column; gap:0.3rem; padding-bottom:0.65rem; border-bottom:1px solid rgba(26,21,48,0.06); }
      .ppvl-detail-qa:last-child { padding-bottom:0; border-bottom:none; }
      .ppvl-detail-qa-lbl { font-size:0.72rem; font-weight:700; color:rgba(26,21,48,0.45); }
      .ppvl-detail-qa-val { font-size:0.87rem; color:#1a1530; line-height:1.75; overflow-wrap:break-word; }
      .ppvl-detail-pills { display:flex; flex-wrap:wrap; gap:0.3rem; }
      .ppvl-detail-pill { background:rgba(26,21,48,0.07); border-radius:99px; padding:0.22rem 0.65rem; font-size:0.72rem; font-weight:700; color:rgba(26,21,48,0.65); }
      .ppvl-detail-pill.warning { background:rgba(209,82,61,0.09); color:#d1523d; }
    `;
    document.head.appendChild(s);
  }

  var pvSaveTimer = null;

  function pvScheduleSave(proposalId) {
    clearTimeout(pvSaveTimer);
    pvSaveTimer = setTimeout(function() { pvSaveScoring(proposalId); }, 800);
  }
  window.pvScheduleSave = pvScheduleSave;

  async function pvSaveScoring(proposalId) {
    const proposal = proposalById(proposalId);
    if (!proposal) return;
    const status = document.getElementById('ppv-save-status');
    if (status) status.textContent = 'Saving...';
    const scoring = proposal.scoring || {};
    const notes = (document.getElementById('ppv-review-notes')?.value || '').trim();
    scoring.notes = notes;
    proposal.scoring = scoring;
    const { error } = await sb().from('production_proposals').update({ scoring }).eq('id', proposalId);
    if (status) {
      status.textContent = error ? 'Error saving' : 'Saved';
      setTimeout(function() { if (status) status.textContent = ''; }, 2000);
    }
    const sub = document.getElementById('ppv-scoring-sub');
    if (sub) {
      const loveCount = (scoring.loves || []).length;
      const challengeCount = (scoring.challenges || []).length;
      sub.textContent = (loveCount || challengeCount) ? `${loveCount} love${loveCount !== 1 ? 's' : ''} · ${challengeCount} challenge${challengeCount !== 1 ? 's' : ''}` : 'Select what applies';
    }
  }
  window.pvSaveScoring = pvSaveScoring;

  function pvReRenderScoring(proposalId) {
    const proposal = proposalById(proposalId);
    if (!proposal) return;
    document.getElementById('ppv-scoring-body').innerHTML = renderScoringPanel(proposal);
    pvSaveScoring(proposalId);
  }

  function pvAddReviewItem(type, proposalId) {
    const input = document.getElementById('ppv-add-' + type);
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    const proposal = proposalById(proposalId);
    if (!proposal) return;
    if (!proposal.scoring) proposal.scoring = {};
    const key = type === 'love' ? 'loves' : 'challenges';
    proposal.scoring[key] = (proposal.scoring[key] || []).concat([val]);
    pvReRenderScoring(proposalId);
  }
  window.pvAddReviewItem = pvAddReviewItem;

  function pvRemoveReviewItem(type, index, proposalId) {
    const proposal = proposalById(proposalId);
    if (!proposal || !proposal.scoring) return;
    const key = type === 'love' ? 'loves' : 'challenges';
    proposal.scoring[key] = (proposal.scoring[key] || []).filter(function(_, i) { return i !== index; });
    pvReRenderScoring(proposalId);
  }
  window.pvRemoveReviewItem = pvRemoveReviewItem;

  function renderScoringPanel(proposal) {
    const scoring = proposal.scoring || {};
    const loves = scoring.loves || [];
    const challenges = scoring.challenges || [];
    const notes = scoring.notes || '';
    const pid = proposal.id;

    var TAG_ICONS = {
      love: '/ASSETS/Images/Icons/volunteer-HEART.svg',
      challenge: '/ASSETS/Images/Icons/Alert.svg'
    };

    function tagRow(items, type) {
      const iconSrc = TAG_ICONS[type];
      const filterStyle = type === 'love' ? 'brightness(0) invert(1)' : 'brightness(0)';
      return items.map(function(item, i) {
        return `<span class="ppv-review-tag ${type}"><img class="ppv-review-tag-icon" src="${iconSrc}" alt="" style="filter:${filterStyle};opacity:0.85;">${esc(item)}<button class="ppv-review-tag-x" onclick="pvRemoveReviewItem('${type}',${i},'${pid}')" title="Remove">&times;</button></span>`;
      }).join('');
    }

    function addRow(type, placeholder) {
      return `<div class="ppv-review-add-row">
        <input class="ppv-review-add-input" id="ppv-add-${type}" type="text" placeholder="${placeholder}" onkeydown="if(event.key==='Enter'){pvAddReviewItem('${type}','${pid}');event.preventDefault();}">
        <button class="ppv-review-add-btn" onclick="pvAddReviewItem('${type}','${pid}')">+ Add</button>
      </div>`;
    }

    return `
      <div class="ppv-review-section">
        <div class="ppv-review-label"><img src="/ASSETS/Images/Icons/volunteer-HEART.svg" class="ppv-label-icon" alt="" style="filter:none;"> What We Love</div>
        <div class="ppv-review-tags">${tagRow(loves, 'love')}</div>
        ${addRow('love', 'e.g. Strong audience appeal')}
      </div>
      <div class="ppv-review-section">
        <div class="ppv-review-label"><img src="/ASSETS/Images/Icons/Alert.svg" class="ppv-label-icon" alt=""> Challenges</div>
        <div class="ppv-review-tags">${tagRow(challenges, 'challenge')}</div>
        ${addRow('challenge', 'e.g. High licensing costs')}
      </div>
      <div class="ppv-review-section">
        <div class="ppv-review-label">Notes</div>
        <textarea class="ppv-review-notes" id="ppv-review-notes" placeholder="Additional notes..." oninput="pvScheduleSave('${pid}')">${esc(notes)}</textarea>
      </div>
      <div class="ppv-save-row"><span class="ppv-save-status" id="ppv-save-status"></span></div>`;
  }

  function ensurePitchViewShell() {
    injectPitchViewStyles();
    if (document.getElementById('ppv-overlay')) return;
    const el = document.createElement('div');
    el.id = 'ppv-overlay';
    el.className = 'ppv-overlay';
    el.innerHTML = `
      <div class="ppv-shell">
        <div class="ppv-topbar">
          <div style="flex:1;min-width:0;">
            <div class="ppv-topbar-org" id="ppv-org-name"></div>
            <div style="display:flex;align-items:baseline;gap:0.6rem;flex-wrap:wrap;">
              <div class="ppv-topbar-title" id="ppv-show-title"></div>
              <div class="ppv-topbar-intake" id="ppv-intake-label"></div>
            </div>
          </div>
          <button class="btn-secondary" style="font-size:0.8rem;padding:0.4rem 0.85rem;" onclick="openProposalModal(document.getElementById('ppv-overlay').dataset.proposalId);closePitchView()">Edit</button>
          <button class="btn-secondary" style="font-size:0.8rem;padding:0.4rem 0.85rem;" onclick="closePitchView()">Close</button>
        </div>
        <div class="ppv-body">
          <div class="ppv-main" id="ppv-main"></div>
          <div class="ppv-scoring">
            <div class="ppv-scoring-head">
              <div class="ppv-scoring-title">Review This Pitch</div>
              <div class="ppv-scoring-sub" id="ppv-scoring-sub">Select what applies</div>
            </div>
            <div class="ppv-scoring-body" id="ppv-scoring-body"></div>
          </div>
        </div>
      </div>`;
    el.addEventListener('click', function(e) { if (e.target === el) closePitchView(); });
    document.body.appendChild(el);
    el.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePitchView(); });
  }

  function openProposalView(id) {
    injectStyles();
    ensurePitchViewShell();
    const proposal = proposalById(id);
    if (!proposal) return;
    const overlay = document.getElementById('ppv-overlay');
    overlay.dataset.proposalId = id;
    const org = currentOrg();
    const intake = proposalIntakeById(proposal.intake_id) || proposal.production_proposal_intakes || null;
    document.getElementById('ppv-org-name').textContent = org?.name || '';
    document.getElementById('ppv-show-title').textContent = proposal.proposed_show_title || 'Untitled Proposal';
    const intakeLabel = [intake?.season_label, intake?.title].filter(Boolean).join(' — ');
    document.getElementById('ppv-intake-label').textContent = intakeLabel ? intakeLabel : '';
    document.getElementById('ppv-main').innerHTML = renderPitchViewMain(proposal, intake);
    document.getElementById('ppv-scoring-body').innerHTML = renderScoringPanel(proposal);
    const scoring = proposal.scoring || {};
    const loveCount = (scoring.loves || []).length;
    const challengeCount = (scoring.challenges || []).length;
    const sub = document.getElementById('ppv-scoring-sub');
    if (sub) sub.textContent = (loveCount || challengeCount) ? `${loveCount} love${loveCount !== 1 ? 's' : ''} · ${challengeCount} challenge${challengeCount !== 1 ? 's' : ''}` : 'Select what applies';
    overlay.classList.add('open');
    document.getElementById('ppv-main').scrollTop = 0;
  }

  function closePitchView() {
    document.getElementById('ppv-overlay')?.classList.remove('open');
  }
  window.closePitchView = closePitchView;

  function pvCard(color, iconSrc, title, bodyHtml) {
    return `<div class="ppv-card" style="background:${color}">
      <div class="ppv-card-hd">
        <img class="ppv-card-icon" src="${iconSrc}" alt="" onerror="this.style.display='none'">
        <span class="ppv-card-title">${esc(title)}</span>
      </div>
      ${bodyHtml}
    </div>`;
  }

  function pvField(label, value, span2) {
    const empty = !value && value !== 0;
    return `<div class="ppv-field"${span2 ? ' style="grid-column:1/-1"' : ''}>
      <div class="ppv-field-lbl">${esc(label)}</div>
      <div class="ppv-field-val${empty ? ' empty' : ''}">${empty ? 'Not provided' : esc(String(value))}</div>
    </div>`;
  }

  function pvQa(label, value) {
    if (!value) return '';
    return `<div class="ppv-qa">
      <div class="ppv-qa-lbl">${esc(label)}</div>
      <div class="ppv-qa-val">${esc(String(value))}</div>
    </div>`;
  }

  function pvPills(values) {
    const arr = Array.isArray(values) ? values : (values ? String(values).split(',').map(s => s.trim()).filter(Boolean) : []);
    if (!arr.length) return '';
    return `<div class="ppv-pill-row">${arr.map(p => `<span class="ppv-pill">${esc(p)}</span>`).join('')}</div>`;
  }

  function pvStars(n) {
    const num = parseInt(n) || 0;
    return '★'.repeat(num) + '<span style="opacity:0.25">' + '★'.repeat(Math.max(0, 5 - num)) + '</span>';
  }

  function renderPitchViewMain(proposal, intake) {
    const fa = proposal.form_answers || {};
    const scoring = proposal.scoring || {};
    const loves = scoring.loves || [];
    const challenges = scoring.challenges || [];

    // Poster
    const posterUrl = fa.sb_cover || '';
    const posterHtml = posterUrl
      ? `<div class="ppvl-poster"><img src="${esc(posterUrl)}" alt="Show poster"></div>`
      : `<div class="ppvl-poster"><div class="ppvl-poster-fallback">${esc((proposal.proposed_show_title || 'S').charAt(0).toUpperCase())}</div></div>`;

    // Sidebar basics
    const licCost = proposal.estimated_licensing_fee != null ? fmtCurrency(proposal.estimated_licensing_fee) : null;
    const runtime = proposal.runtime_minutes || fa.sb_runtime;
    const acts = fa.sb_acts;
    const edition = proposal.show_version;

    function basicItem(iconPath, value, label) {
      if (!value && value !== 0) return '';
      return `<div class="ppvl-basic-item">
        <img class="ppvl-basic-icon" src="${iconPath}" alt="">
        <div>
          <div class="ppvl-basic-value">${esc(String(value))}</div>
          <div class="ppvl-basic-label">${esc(label)}</div>
        </div>
      </div>`;
    }

    const sidebarHtml = `
      ${posterHtml}
      <div class="ppvl-basics">
        <div class="ppvl-basics-title">The Basics</div>
        ${basicItem('/ASSETS/Images/Icons/History.svg', runtime ? runtime + ' min' : null, 'Runtime')}
        ${basicItem('/ASSETS/Images/Icons/script-scene.svg', acts ? acts + (acts == 1 ? ' Act' : ' Acts') : null, 'Number of Acts')}
        ${basicItem('/ASSETS/Images/Icons/Files.svg', edition, 'Version / Edition')}
        ${basicItem('/ASSETS/Images/Icons/Finance - Final.svg', licCost, 'Est. Licensing Cost')}
      </div>`;

    // Hero content
    const genre = proposal.genre_type || fa.sb_genre || '';
    const logline = fa.why_pitching || '';
    const synopsis = proposal.short_synopsis || '';

    // Inline review block (shows scoring data if available)
    let reviewHtml = '';
    if (loves.length || challenges.length) {
      const loveItems = loves.map(function(item) {
        return `<div class="ppvl-review-list-item"><img class="ppvl-review-list-icon" src="/ASSETS/Images/Icons/volunteer-approved.svg" alt=""><span>${esc(item)}</span></div>`;
      }).join('');
      const challengeItems = challenges.map(function(item) {
        return `<div class="ppvl-review-list-item"><img class="ppvl-review-list-icon" src="/ASSETS/Images/Icons/Alert.svg" alt=""><span>${esc(item)}</span></div>`;
      }).join('');
      reviewHtml = `<div class="ppvl-review-row">
        ${loves.length ? `<div class="ppvl-review-col">
          <div class="ppvl-review-col-head love"><img class="ppvl-review-col-icon" src="/ASSETS/Images/Icons/volunteer-HEART.svg" alt=""><span class="ppvl-review-col-title">What We Love</span></div>
          <div class="ppvl-review-col-body"><div class="ppvl-review-list">${loveItems}</div></div>
        </div>` : ''}
        ${challenges.length ? `<div class="ppvl-review-col">
          <div class="ppvl-review-col-head challenge"><img class="ppvl-review-col-icon" src="/ASSETS/Images/Icons/Alert.svg" alt=""><span class="ppvl-review-col-title">Things to Consider</span></div>
          <div class="ppvl-review-col-body"><div class="ppvl-review-list">${challengeItems}</div></div>
        </div>` : ''}
      </div>`;
    }

    // Footer fields
    function footerField(label, value) {
      return `<div class="ppvl-footer-field">
        <div class="ppvl-footer-lbl">${esc(label)}</div>
        <div class="ppvl-footer-val${value ? '' : ' empty'}">${value ? esc(value) : 'Not provided'}</div>
      </div>`;
    }

    const footerHtml = `<div class="ppvl-footer-fields">
      ${footerField('Licensing Company', proposal.licensing_company)}
      ${footerField('Author / Composer / Playwright', fa.sb_author)}
      ${fa.sb_licensing_link ? `<div class="ppvl-footer-field"><div class="ppvl-footer-lbl">Licensing Link</div><div class="ppvl-footer-val" style="font-size:0.7rem;">${esc(fa.sb_licensing_link)}</div></div>` : ''}
    </div>`;

    // Detail sections (scrollable below)
    function detailSection(iconPath, title, bodyHtml, color) {
      if (!bodyHtml) return '';
      const bg = color || '#572e88';
      return `<div class="ppvl-detail-section">
        <div class="ppvl-detail-section-head" style="background:${bg}">
          <img class="ppvl-detail-section-icon" src="${iconPath}" alt="">
          <span class="ppvl-detail-section-title">${esc(title)}</span>
        </div>
        <div class="ppvl-detail-section-body">${bodyHtml}</div>
      </div>`;
    }
    function dField(label, value) {
      if (!value && value !== 0) return '';
      return `<div class="ppvl-detail-field"><div class="ppvl-detail-field-lbl">${esc(label)}</div><div class="ppvl-detail-field-val">${esc(String(value))}</div></div>`;
    }
    function dQ(label, value) {
      if (!value) return '';
      return `<div class="ppvl-detail-qa"><div class="ppvl-detail-qa-lbl">${esc(label)}</div><div class="ppvl-detail-qa-val">${esc(String(value))}</div></div>`;
    }
    function dPills(values) {
      const arr = Array.isArray(values) ? values : (values ? String(values).split(',').map(function(s){return s.trim();}).filter(Boolean) : []);
      return arr.length ? `<div class="ppvl-detail-pills">${arr.map(function(p){return `<span class="ppvl-detail-pill">${esc(p)}</span>`;}).join('')}</div>` : '';
    }

    const submitterBody = `<div class="ppvl-detail-grid">
      ${dField('Name', fa.si_name || proposal.pitch_submitted_by)}
      ${dField('Email', fa.si_email || proposal.submitter_email)}
      ${dField('Phone', fa.si_phone || proposal.submitter_phone)}
      ${dField('Role / Relationship', fa.si_role)}
    </div>`;

    const castBody = `<div class="ppvl-detail-grid">
      ${dField('Named Roles', proposal.named_roles)}
      ${dField('Ensemble Opportunities', fa.cast_ensemble || proposal.ensemble_opportunities)}
      ${dField('Featured Dancers', fa.cast_featured_dancers)}
    </div>${dQ('Casting Notes', fa.cast_notes || proposal.character_list)}`;

    const whyBody = dQ('Why are you pitching this show?', fa.why_pitching)
      + dQ('Why is this a good fit?', fa.why_fit || proposal.organization_fit)
      + dQ('Why is this the right time?', fa.why_now)
      + dQ('Why would audiences come?', fa.why_appeal)
      + dQ('Why choose this over others?', fa.why_over_others);

    const hasDiff = fa.mu_vocal_diff || fa.mu_dance_diff || fa.mu_music_diff;
    const musicBody = `<div class="ppvl-detail-grid">
      ${dField('Type of Production', fa.mu_production_type || proposal.production_type)}
      ${dField('Number of Songs', fa.mu_songs || proposal.number_of_songs)}
      ${dField('Major Dance Numbers', fa.mu_dance_numbers === 'yes' ? 'Yes' : fa.mu_dance_numbers === 'no' ? 'No' : '')}
      ${hasDiff ? dField('Vocal Difficulty', fa.mu_vocal_diff ? '★'.repeat(fa.mu_vocal_diff) : '') : ''}
      ${hasDiff ? dField('Dance Difficulty', fa.mu_dance_diff ? '★'.repeat(fa.mu_dance_diff) : '') : ''}
      ${hasDiff ? dField('Music Difficulty', fa.mu_music_diff ? '★'.repeat(fa.mu_music_diff) : '') : ''}
    </div>${dQ('Music Style', fa.mu_music_style)}${dQ('Key Numbers', fa.mu_key_numbers)}`;

    const audience = fa.why_audience;
    const warnings = fa.cs_warnings || proposal.content_warnings;
    const contentBody = (audience ? `<div class="ppvl-detail-qa-lbl">Audience</div>${dPills(audience)}` : '')
      + (warnings ? `<div class="ppvl-detail-qa-lbl" style="margin-top:0.6rem;">Content Warnings</div><div class="ppvl-detail-pills">${String(warnings).split(',').map(function(s){return `<span class="ppvl-detail-pill warning">${esc(s.trim())}</span>`;}).join('')}</div>` : '')
      + dQ('Suitability Notes', fa.cs_notes);

    const risksBody = dQ('Biggest Challenge', fa.ri_challenge || proposal.biggest_challenge)
      + dQ('What could make this difficult?', fa.ri_difficult)
      + dQ('How we will manage it', fa.ri_manage);

    return `<div class="ppvl-layout">
      <div class="ppvl-sidebar">${sidebarHtml}</div>
      <div class="ppvl-content">
        <div>
          <div class="ppvl-kicker">Show Pitch</div>
          <div class="ppvl-title">${esc((proposal.proposed_show_title || 'Untitled').toUpperCase())}</div>
          ${genre ? `<div class="ppvl-genre">${esc(genre.toUpperCase())}</div>` : ''}
        </div>
        ${logline ? `<div><div class="ppvl-content-label">Why we're pitching this</div><p class="ppvl-logline">${esc(logline)}</p></div>` : ''}
        ${synopsis ? `<div><div class="ppvl-content-label">Synopsis</div><div class="ppvl-synopsis">${esc(synopsis)}</div></div>` : ''}
        ${reviewHtml}
        ${footerHtml}
        <div class="ppvl-details">
          ${detailSection('/ASSETS/Images/Icons/Profiles.svg', 'Submitter', submitterBody, '#476aaa')}
          ${detailSection('/ASSETS/Images/Icons/Casting Board.svg', 'Casting', castBody, '#d1523d')}
          ${whyBody ? detailSection('/ASSETS/Images/Icons/volunteer-HEART.svg', 'Why This Show?', whyBody, '#ca7ea7') : ''}
          ${detailSection('/ASSETS/Images/Icons/script-music-songs.svg', 'Music & Choreography', musicBody, '#769e7b')}
          ${contentBody ? detailSection('/ASSETS/Images/Icons/Information.svg', 'Content & Suitability', contentBody, '#769e7b') : ''}
          ${risksBody ? detailSection('/ASSETS/Images/Icons/Alert.svg', 'Risks & Challenges', risksBody, '#efab45') : ''}
        </div>
      </div>
    </div>`;
  }

  window.openProposalView = openProposalView;

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

  function renderProposalProjectRow(proj) {
    const id = proj.id || ('p' + Date.now() + Math.random().toString(36).slice(2, 6));
    const h = 'height:42px;box-sizing:border-box;';
    return '<div class="ppi-project-row" data-proj-id="' + id + '" style="display:flex;flex-direction:column;gap:0.65rem;padding:0.75rem;background:rgba(87,46,136,0.04);border:1px solid rgba(87,46,136,0.1);border-radius:12px;">' +
      '<div style="display:flex;gap:0.65rem;align-items:flex-end;">' +
        '<div class="form-group" style="margin:0;flex:1;"><label class="form-label">Project Name</label><input class="form-input ppi-proj-name" type="text" placeholder="Kids, Youth, Workshop..." value="' + esc(proj.name || '') + '" style="' + h + '" /></div>' +
        '<button type="button" class="btn-secondary" style="' + h + 'color:#d1523d;border-color:rgba(209,82,61,0.3);flex-shrink:0;" onclick="removeProposalProject(\'' + id + '\')">Remove</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 88px 88px;gap:0.65rem;">' +
        '<div class="form-group" style="margin:0;"><label class="form-label">Production Type</label><select class="form-select ppi-proj-type" style="' + h + '"><option value="">No preference</option><option value="Musical"' + (proj.production_type === 'Musical' ? ' selected' : '') + '>Musical</option><option value="Play"' + (proj.production_type === 'Play' ? ' selected' : '') + '>Play</option><option value="Workshop"' + (proj.production_type === 'Workshop' ? ' selected' : '') + '>Workshop</option></select></div>' +
        '<div class="form-group" style="margin:0;"><label class="form-label">Min Age</label><input class="form-input ppi-proj-min-age" type="number" min="0" max="99" placeholder="—" value="' + (proj.min_age ?? '') + '" style="' + h + '" /></div>' +
        '<div class="form-group" style="margin:0;"><label class="form-label">Max Age</label><input class="form-input ppi-proj-max-age" type="number" min="0" max="99" placeholder="—" value="' + (proj.max_age ?? '') + '" style="' + h + '" /></div>' +
      '</div>' +
    '</div>';
  }

  function proposalIntakeNextStep() {
    const step1 = document.getElementById('ppi-step-1');
    const step2 = document.getElementById('ppi-step-2');
    const step3 = document.getElementById('ppi-step-3');
    if (step1 && step1.style.display !== 'none') {
      const title = document.getElementById('ppi-title').value.trim();
      const errorEl = document.getElementById('proposal-intake-form-error');
      if (!title) { errorEl.textContent = 'Season name is required.'; errorEl.classList.add('visible'); return; }
      errorEl.classList.remove('visible');
      errorEl.textContent = '';
      step1.style.display = 'none';
      step2.style.display = '';
      document.getElementById('ppi-step-pill-2').style.background = '#572e88';
    } else if (step2 && step2.style.display !== 'none') {
      step2.style.display = 'none';
      step3.style.display = '';
      document.getElementById('ppi-step-pill-3').style.background = '#572e88';
      const shell = document.querySelector('.intake-modal-shell');
      if (shell) shell.classList.add('pfb-wide');
      renderFormBuilder();
    }
  }

  function proposalIntakePrevStep() {
    const step2 = document.getElementById('ppi-step-2');
    const step3 = document.getElementById('ppi-step-3');
    if (step3 && step3.style.display !== 'none') {
      step3.style.display = 'none';
      step2.style.display = '';
      document.getElementById('ppi-step-pill-3').style.background = 'rgba(87,46,136,0.15)';
      const shell = document.querySelector('.intake-modal-shell');
      if (shell) shell.classList.remove('pfb-wide');
    } else {
      step2.style.display = 'none';
      document.getElementById('ppi-step-1').style.display = '';
      document.getElementById('ppi-step-pill-2').style.background = 'rgba(87,46,136,0.15)';
    }
  }

  // ---- Form Builder ----
  var pfbOpenQuestions = new Set();
  var pfbSelectedSectionId = null;

  function pfbGetSection(sId) { return currentFormConfig && currentFormConfig.sections.find(function(s){ return s.id === sId; }); }
  function pfbGetQuestion(sId, qId) { var s = pfbGetSection(sId); return s ? s.questions.find(function(q){ return q.id === qId; }) : null; }

  function pfbToggleQuestionSettings(sId, qId) {
    var key = sId+'|'+qId;
    if (pfbOpenQuestions.has(key)) pfbOpenQuestions.delete(key);
    else pfbOpenQuestions.add(key);
    var el = document.querySelector('.pfb-question[data-qid="'+qId+'"]');
    if (el) el.classList.toggle('pfb-q--settings-open', pfbOpenQuestions.has(key));
  }

  function pfbSelectSection(sId) {
    pfbSelectedSectionId = sId;
    renderFBSidebar();
    renderFBMain();
  }

  function renderFormBuilder() {
    if (!currentFormConfig || !currentFormConfig.sections.length) return;
    if (!pfbSelectedSectionId || !pfbGetSection(pfbSelectedSectionId)) {
      pfbSelectedSectionId = currentFormConfig.sections[0].id;
    }
    renderFBSidebar();
    renderFBMain();
  }

  function renderFBSidebar() {
    var sidebar = document.getElementById('ppi-fb-sidebar');
    if (!sidebar || !currentFormConfig) return;
    sidebar.innerHTML = currentFormConfig.sections.map(function(section) {
      var isActive = section.id === pfbSelectedSectionId;
      var qOn = section.questions.filter(function(q){ return q.enabled !== false; }).length;
      return '<div class="pfb-sidebar-item'+(isActive?' pfb-sidebar-item--active':'')+(section.enabled?'':' pfb-sidebar-item--disabled')+'" onclick="pfbSelectSection(\''+esc(section.id)+'\')">'
        +'<span class="pfb-sidebar-name">'+esc(section.title)+'</span>'
        +'<span class="pfb-q-count">'+qOn+'</span>'
        +'<label class="pfb-toggle-small" onclick="event.stopPropagation()">'
        +'<input type="checkbox" '+(section.enabled?'checked':'')+' onchange="pfbToggleSection(\''+esc(section.id)+'\',this.checked);renderFBSidebar();">'
        +'<span class="pfb-toggle-track"></span><span class="pfb-toggle-thumb"></span></label>'
        +'</div>';
    }).join('')
    +'<div class="pfb-sidebar-footer"><button type="button" class="pfb-sidebar-add-btn" onclick="pfbAddSection()">+ Add Section</button></div>';
  }

  function renderFBMain() {
    var main = document.getElementById('ppi-fb-main');
    if (!main || !currentFormConfig) return;
    var section = pfbGetSection(pfbSelectedSectionId);
    if (!section) { main.innerHTML = '<div style="padding:2rem 1rem;color:rgba(87,46,136,0.35);font-size:0.84rem;">Select a section on the left.</div>'; return; }
    var sIdx = currentFormConfig.sections.indexOf(section);
    var total = currentFormConfig.sections.length;
    var questionsHtml = section.questions.map(function(q, qIdx) {
      return renderFBQuestion(q, section.id, qIdx, section.questions.length);
    }).join('');
    main.innerHTML = '<div class="pfb-main-head">'
      +'<input class="pfb-section-title-input" value="'+esc(section.title)+'" onchange="pfbRenameSectionSync(\''+esc(section.id)+'\',this.value)" />'
      +'<button type="button" class="pfb-btn" onclick="pfbMoveSection(\''+esc(section.id)+'\',-1)" '+(sIdx===0?'disabled':'')+' title="Move up">↑</button>'
      +'<button type="button" class="pfb-btn" onclick="pfbMoveSection(\''+esc(section.id)+'\',1)" '+(sIdx===total-1?'disabled':'')+' title="Move down">↓</button>'
      +'<button type="button" class="pfb-btn pfb-btn--danger" onclick="pfbDeleteSection(\''+esc(section.id)+'\')" title="Remove section">✕</button>'
      +'<label class="pfb-toggle-small"><input type="checkbox" '+(section.enabled?'checked':'')+' onchange="pfbToggleSection(\''+esc(section.id)+'\',this.checked);renderFBSidebar();"><span class="pfb-toggle-track"></span><span class="pfb-toggle-thumb"></span></label>'
      +'</div>'
      +'<div class="pfb-main-body">'+questionsHtml
      +'<button type="button" class="pfb-add-q-btn" onclick="pfbAddQuestion(\''+esc(section.id)+'\')">+ Add Question</button>'
      +'</div>';
    pfbOpenQuestions.forEach(function(key) {
      if (key.split('|')[0] !== section.id) return;
      var qId = key.split('|')[1];
      var el = main.querySelector('.pfb-question[data-qid="'+qId+'"]');
      if (el) el.classList.add('pfb-q--settings-open');
    });
  }

  function pfbRenameSectionSync(sId, v) {
    pfbRenameSection(sId, v);
    renderFBSidebar();
  }

  function renderFBQuestion(q, sId, qIdx, totalQ) {
    var typeLabel = (QUESTION_TYPES.find(function(t){ return t.value===q.type; })||{label:q.type}).label;
    var hasOptions = q.type === 'dropdown' || q.type === 'checkbox';
    var typeSelOpts = QUESTION_TYPES.map(function(t){ return '<option value="'+t.value+'"'+(q.type===t.value?' selected':'')+'>'+esc(t.label)+'</option>'; }).join('');

    var inlineOptionsHtml = hasOptions ? (
      '<div class="pfb-q-options-inline">'
      +'<div class="pfb-q-options-label">Options</div>'
      +(q.options||[]).map(function(opt, oIdx){
        return '<div class="pfb-q-option-row">'
          +'<input class="pfb-q-option-input" value="'+esc(opt)+'" onchange="pfbUpdateOption(\''+esc(sId)+'\',\''+esc(q.id)+'\','+oIdx+',this.value)" />'
          +'<button type="button" class="pfb-btn pfb-btn--danger" onclick="pfbDeleteOption(\''+esc(sId)+'\',\''+esc(q.id)+'\','+oIdx+')">✕</button></div>';
      }).join('')
      +'<button type="button" class="pfb-btn" style="margin-top:0.25rem;align-self:flex-start;" onclick="pfbAddOption(\''+esc(sId)+'\',\''+esc(q.id)+'\')">+ Add Option</button>'
      +'</div>'
    ) : '';

    return '<div class="pfb-question'+(q.enabled?'':' pfb-question--disabled')+'" data-qid="'+esc(q.id)+'">'
      +'<div class="pfb-q-row">'
      +'<div class="pfb-q-move-btns">'
      +'<button type="button" class="pfb-btn" style="padding:0.1rem 0.32rem;font-size:0.6rem;" onclick="pfbMoveQuestion(\''+esc(sId)+'\',\''+esc(q.id)+'\',-1)" '+(qIdx===0?'disabled':'')+'>↑</button>'
      +'<button type="button" class="pfb-btn" style="padding:0.1rem 0.32rem;font-size:0.6rem;" onclick="pfbMoveQuestion(\''+esc(sId)+'\',\''+esc(q.id)+'\',1)" '+(qIdx===totalQ-1?'disabled':'')+'>↓</button>'
      +'</div>'
      +'<input class="pfb-q-label-input" value="'+esc(q.label)+'" placeholder="Question label" onchange="pfbUpdateQ(\''+esc(sId)+'\',\''+esc(q.id)+'\',\'label\',this.value)" />'
      +'<span class="pfb-q-type-pill">'+esc(typeLabel)+'</span>'
      +'<button type="button" class="pfb-q-req-pill '+(q.required?'pfb-q-req-pill--required':'pfb-q-req-pill--optional')+'" onclick="pfbToggleRequired(\''+esc(sId)+'\',\''+esc(q.id)+'\')">'+(q.required?'Required':'Optional')+'</button>'
      +'<div class="pfb-q-btns">'
      +'<button type="button" class="pfb-btn pfb-btn--gear" onclick="pfbToggleQuestionSettings(\''+esc(sId)+'\',\''+esc(q.id)+'\')" title="More settings"><img src="/ASSETS/Images/Icons/navsettings.svg" alt="Settings"></button>'
      +'<label class="pfb-toggle-small" title="Show / hide question"><input type="checkbox" '+(q.enabled?'checked':'')+' onchange="pfbUpdateQ(\''+esc(sId)+'\',\''+esc(q.id)+'\',\'enabled\',this.checked)"><span class="pfb-toggle-track"></span><span class="pfb-toggle-thumb"></span></label>'
      +'<button type="button" class="pfb-btn pfb-btn--danger" onclick="pfbDeleteQuestion(\''+esc(sId)+'\',\''+esc(q.id)+'\')">✕</button>'
      +'</div></div>'
      +inlineOptionsHtml
      +'<div class="pfb-q-settings">'
      +'<div class="pfb-q-settings-row">'
      +'<div class="pfb-q-field-wrap"><span class="pfb-q-settings-label">Type</span>'
      +'<select class="pfb-q-type-sel" onchange="pfbUpdateQ(\''+esc(sId)+'\',\''+esc(q.id)+'\',\'type\',this.value)">'+typeSelOpts+'</select></div>'
      +'<div class="pfb-q-field-wrap"><span class="pfb-q-settings-label">Help text</span>'
      +'<input class="pfb-q-help-input" value="'+esc(q.help_text||'')+'" placeholder="Shown below the label" onchange="pfbUpdateQ(\''+esc(sId)+'\',\''+esc(q.id)+'\',\'help_text\',this.value)" /></div>'
      +'<div class="pfb-q-field-wrap"><span class="pfb-q-settings-label">Placeholder</span>'
      +'<input class="pfb-q-placeholder-input" value="'+esc(q.placeholder||'')+'" placeholder="Input placeholder" onchange="pfbUpdateQ(\''+esc(sId)+'\',\''+esc(q.id)+'\',\'placeholder\',this.value)" /></div>'
      +'<label class="pfb-q-req-lbl"><input type="checkbox" '+(q.required?'checked':'')+' onchange="pfbUpdateQ(\''+esc(sId)+'\',\''+esc(q.id)+'\',\'required\',this.checked)"> Required</label>'
      +'</div>'
      +'</div></div>';
  }

  function pfbToggleRequired(sId, qId) { var q=pfbGetQuestion(sId,qId); if(q){ q.required=!q.required; renderFBMain(); } }
  function pfbToggleSection(sId, enabled) { var s=pfbGetSection(sId); if(s){s.enabled=enabled; renderFormBuilder();} }
  function pfbRenameSection(sId, v) { var s=pfbGetSection(sId); if(s) s.title=v; }
  function pfbMoveSection(sId, dir) {
    var secs=currentFormConfig.sections, idx=secs.findIndex(function(s){return s.id===sId;}), ni=idx+dir;
    if(idx<0||ni<0||ni>=secs.length) return;
    var tmp=secs[idx]; secs[idx]=secs[ni]; secs[ni]=tmp; renderFormBuilder();
  }
  function pfbDuplicateSection(sId) {
    var secs=currentFormConfig.sections, idx=secs.findIndex(function(s){return s.id===sId;});
    if(idx<0) return;
    var copy=JSON.parse(JSON.stringify(secs[idx]));
    copy.id='sec_'+Date.now(); copy.title=copy.title+' (copy)';
    copy.questions=copy.questions.map(function(q){return Object.assign({},q,{id:q.id+'_'+Date.now()});});
    secs.splice(idx+1,0,copy); renderFormBuilder();
  }
  function pfbDeleteSection(sId) {
    if(!window.confirm('Delete this section and all its questions?')) return;
    currentFormConfig.sections=currentFormConfig.sections.filter(function(s){return s.id!==sId;});
    if (pfbSelectedSectionId === sId) pfbSelectedSectionId = currentFormConfig.sections.length ? currentFormConfig.sections[0].id : null;
    renderFormBuilder();
  }
  function pfbAddSection() {
    var newId = 'sec_'+Date.now();
    currentFormConfig.sections.push({id:newId,title:'New Section',enabled:true,questions:[]});
    pfbSelectedSectionId = newId;
    renderFormBuilder();
  }
  function pfbUpdateQ(sId, qId, field, value) {
    var q=pfbGetQuestion(sId,qId); if(!q) return; q[field]=value;
    if(field==='type') renderFormBuilder();
  }
  function pfbMoveQuestion(sId, qId, dir) {
    var s=pfbGetSection(sId); if(!s) return;
    var idx=s.questions.findIndex(function(q){return q.id===qId;}), ni=idx+dir;
    if(idx<0||ni<0||ni>=s.questions.length) return;
    var tmp=s.questions[idx]; s.questions[idx]=s.questions[ni]; s.questions[ni]=tmp; renderFormBuilder();
  }
  function pfbDeleteQuestion(sId, qId) {
    var s=pfbGetSection(sId); if(!s) return;
    s.questions=s.questions.filter(function(q){return q.id!==qId;}); renderFormBuilder();
  }
  function pfbAddQuestion(sId) {
    var s=pfbGetSection(sId); if(!s) return;
    s.questions.push(mkQ('q_'+Date.now(),'New Question','short_answer')); renderFormBuilder();
  }
  function pfbAddOption(sId, qId) {
    var q=pfbGetQuestion(sId,qId); if(!q) return;
    if(!q.options) q.options=[];
    q.options.push('Option '+(q.options.length+1)); renderFormBuilder();
  }
  function pfbDeleteOption(sId, qId, oIdx) {
    var q=pfbGetQuestion(sId,qId); if(!q||!q.options) return;
    q.options.splice(oIdx,1); renderFormBuilder();
  }
  function pfbUpdateOption(sId, qId, oIdx, value) {
    var q=pfbGetQuestion(sId,qId); if(!q||!q.options) return; q.options[oIdx]=value;
  }
  // ---- End Form Builder ----

  function syncProjectsEmpty() {
    const list = document.getElementById('ppi-projects-list');
    const empty = document.getElementById('ppi-projects-empty');
    if (!list || !empty) return;
    empty.style.display = list.children.length === 0 ? '' : 'none';
  }

  function addProposalProject(proj) {
    const list = document.getElementById('ppi-projects-list');
    if (!list) return;
    const div = document.createElement('div');
    div.innerHTML = renderProposalProjectRow(proj || {});
    list.appendChild(div.firstElementChild);
    syncProjectsEmpty();
  }

  function removeProposalProject(projId) {
    const row = document.querySelector('[data-proj-id="' + projId + '"]');
    if (row) row.remove();
    syncProjectsEmpty();
  }

  function openProposalIntakeModal(id) {
    ensureModalShell();
    const intake = id ? proposalIntakeById(id) : null;
    const modal = document.getElementById('proposal-intake-modal');
    modal.dataset.intakeId = id || '';

    document.getElementById('proposal-intake-modal-title').textContent = intake ? 'Edit Season' : 'Add Season';
    document.getElementById('ppi-save-btn').textContent = intake ? 'Save Season' : 'Create Season';
    document.getElementById('ppi-delete-btn').style.display = intake ? 'block' : 'none';
    document.getElementById('proposal-intake-form-error').classList.remove('visible');
    document.getElementById('proposal-intake-form-error').textContent = '';

    // always start on step 1
    document.getElementById('ppi-step-1').style.display = '';
    document.getElementById('ppi-step-2').style.display = 'none';
    document.getElementById('ppi-step-3').style.display = 'none';
    document.getElementById('ppi-step-pill-2').style.background = 'rgba(87,46,136,0.15)';
    document.getElementById('ppi-step-pill-3').style.background = 'rgba(87,46,136,0.15)';
    const shell = document.querySelector('.intake-modal-shell');
    if (shell) shell.classList.remove('pfb-wide');
    currentFormConfig = intake && intake.form_config ? JSON.parse(JSON.stringify(intake.form_config)) : JSON.parse(JSON.stringify(DEFAULT_FORM_CONFIG));
    if (intake && intake.form_config) {
      var defCopy = JSON.parse(JSON.stringify(DEFAULT_FORM_CONFIG));
      defCopy.sections.forEach(function(defSec) {
        var savedSec = currentFormConfig.sections.find(function(s) { return s.id === defSec.id; });
        if (!savedSec) {
          var newSec = Object.assign({}, defSec, { enabled: false });
          newSec.questions = defSec.questions.map(function(q) { return Object.assign({}, q, { enabled: false }); });
          currentFormConfig.sections.push(newSec);
        } else {
          defSec.questions.forEach(function(defQ) {
            var exists = savedSec.questions.some(function(q) { return q.id === defQ.id; });
            if (!exists) savedSec.questions.push(Object.assign({}, defQ, { enabled: false }));
          });
        }
      });
    }
    pfbOpenQuestions = new Set();
    pfbSelectedSectionId = null;

    document.getElementById('ppi-title').value = intake?.title || '';
    document.getElementById('ppi-season-year').value = intake?.season_label || '';
    document.getElementById('ppi-description').value = intake?.description || '';
    document.getElementById('ppi-access-code').value = intake?.access_code || generateProposalToken().slice(0, 8).toLowerCase();
    document.getElementById('ppi-closes-at').value = fmtDateTimeInput(intake?.closes_at || '');
    document.getElementById('ppi-is-open').value = intake?.is_open === false ? 'no' : 'yes';

    const list = document.getElementById('ppi-projects-list');
    if (list) {
      list.innerHTML = '';
      const projects = Array.isArray(intake?.projects) ? intake.projects : [];
      projects.forEach(function(p) { addProposalProject(p); });
      syncProjectsEmpty();
    }

    modal.classList.add('open');
  }

  function closeProposalIntakeModal() {
    document.getElementById('proposal-intake-modal')?.classList.remove('open');
  }

  async function saveProposalIntakeForm() {
    const modal = document.getElementById('proposal-intake-modal');
    const intakeId = modal?.dataset?.intakeId || '';
    const errorEl = document.getElementById('proposal-intake-form-error');
    const title = document.getElementById('ppi-title').value.trim();
    const yearVal = document.getElementById('ppi-season-year').value.trim();
    if (!title) {
      errorEl.textContent = 'Season name is required.';
      errorEl.classList.add('visible');
      return;
    }
    const projectRows = Array.from(document.querySelectorAll('#ppi-projects-list .ppi-project-row'));
    const projects = projectRows.map(function(row) {
      const minAge = row.querySelector('.ppi-proj-min-age').value;
      const maxAge = row.querySelector('.ppi-proj-max-age').value;
      return {
        id: row.dataset.projId,
        name: row.querySelector('.ppi-proj-name').value.trim(),
        production_type: row.querySelector('.ppi-proj-type').value || null,
        min_age: minAge !== '' ? parseInt(minAge, 10) : null,
        max_age: maxAge !== '' ? parseInt(maxAge, 10) : null,
      };
    }).filter(function(p) { return p.name; });
    const payload = {
      organization_id: currentOrg().id,
      title: title,
      season_label: yearVal || null,
      description: document.getElementById('ppi-description').value.trim() || null,
      parent_id: null,
      closes_at: document.getElementById('ppi-closes-at').value ? new Date(document.getElementById('ppi-closes-at').value).toISOString() : null,
      is_open: document.getElementById('ppi-is-open').value === 'yes',
      projects: projects,
      form_config: currentFormConfig || DEFAULT_FORM_CONFIG,
    };
    if (!intakeId) {
      payload.access_code = document.getElementById('ppi-access-code').value.trim();
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
      showToast(intakeId ? 'Season updated.' : 'Season created.');
    } catch (error) {
      console.error('[BTS] save proposal intake failed', error);
      errorEl.textContent = error.message || 'Could not save season.';
      errorEl.classList.add('visible');
    }
  }

  async function proposalIntakeDelete() {
    const modal = document.getElementById('proposal-intake-modal');
    const intakeId = modal?.dataset?.intakeId;
    if (!intakeId) return;
    const intake = proposalIntakeById(intakeId);
    const submissionCount = state.proposals.filter(function(p) { return p.intake_id === intakeId; }).length;
    const name = intake?.title || 'this season';
    const warning = submissionCount > 0
      ? 'Delete "' + name + '"? This will permanently remove the season and its ' + submissionCount + ' ' + (submissionCount === 1 ? 'proposal' : 'proposals') + '. This cannot be undone.'
      : 'Delete "' + name + '"? This cannot be undone.';
    closeProposalIntakeModal();
    await deleteProposalIntake(intakeId, submissionCount, warning);
  }

  async function deleteProposalIntakeById(intakeId) {
    const intake = proposalIntakeById(intakeId);
    const submissionCount = state.proposals.filter(function(p) { return p.intake_id === intakeId; }).length;
    const name = intake?.title || 'this season';
    const warning = submissionCount > 0
      ? 'Delete "' + name + '"? This will permanently remove the season and its ' + submissionCount + ' ' + (submissionCount === 1 ? 'proposal' : 'proposals') + '. This cannot be undone.'
      : 'Delete "' + name + '"? This cannot be undone.';
    await deleteProposalIntake(intakeId, submissionCount, warning);
  }

  async function deleteProposalIntake(intakeId, proposalCount, warningMsg) {
    const confirmed = window.confirm(warningMsg);
    if (!confirmed) return;
    try {
      if (proposalCount > 0) {
        await sb().from('production_proposals').delete().eq('intake_id', intakeId);
      }
      const { error } = await sb().from('production_proposal_intakes').delete().eq('id', intakeId);
      if (error) throw error;
      if (state.selectedIntakeId === intakeId) state.selectedIntakeId = 'all';
      await loadProductionProposalIntakes();
      renderProposalsTab();
      showToast('Season deleted.');
    } catch (err) {
      console.error('[BTS] delete intake failed', err);
      showToast(err.message || 'Could not delete season.', true);
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
  window.deleteProposalIntake = deleteProposalIntake;
  window.deleteProposalIntakeById = deleteProposalIntakeById;
  window.proposalIntakeDelete = proposalIntakeDelete;
  window.addProposalProject = addProposalProject;
  window.removeProposalProject = removeProposalProject;
  window.proposalIntakeNextStep = proposalIntakeNextStep;
  window.proposalIntakePrevStep = proposalIntakePrevStep;
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
  window.renderFormBuilder = renderFormBuilder;
  window.renderFBSidebar = renderFBSidebar;
  window.renderFBMain = renderFBMain;
  window.pfbSelectSection = pfbSelectSection;
  window.pfbToggleQuestionSettings = pfbToggleQuestionSettings;
  window.pfbToggleRequired = pfbToggleRequired;
  window.pfbRenameSectionSync = pfbRenameSectionSync;
  window.pfbToggleSection = pfbToggleSection;
  window.pfbRenameSection = pfbRenameSection;
  window.pfbMoveSection = pfbMoveSection;
  window.pfbDuplicateSection = pfbDuplicateSection;
  window.pfbDeleteSection = pfbDeleteSection;
  window.pfbAddSection = pfbAddSection;
  window.pfbUpdateQ = pfbUpdateQ;
  window.pfbMoveQuestion = pfbMoveQuestion;
  window.pfbDeleteQuestion = pfbDeleteQuestion;
  window.pfbAddQuestion = pfbAddQuestion;
  window.pfbAddOption = pfbAddOption;
  window.pfbDeleteOption = pfbDeleteOption;
  window.pfbUpdateOption = pfbUpdateOption;
  window.archiveProposal = archiveProposal;
  window.exportProposalPdf = exportProposalPdf;
  window.deleteProposalAttachment = function (fileId) { deleteProposalAttachment(fileId).catch(err => showToast(err.message || 'Could not remove attachment.', true)); };
  window.createProductionFromProposal = createProductionFromProposal;
  window.approveAndBuildProposal = approveAndBuildProposal;
}());
