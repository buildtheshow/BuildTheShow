/**
 * ═══════════════════════════════════════════════════════════════
 * CASTING CARD BACK — Shared component
 * Builds the coloured section-based back-of-card HTML.
 * Used anywhere a performer detail panel is needed:
 *   - In The Room (production-workspace.html)
 *   - Performers lightbox (casting board)
 *
 * Requires the following CSS classes to be present on the page:
 *   .inroom-back-scroll, .irb-section, .irb-section-label,
 *   .irb-section-rows, .irb-row, .irb-row-key, .irb-row-val,
 *   .irb-notes, .irb-score-grid, .irb-score-pair,
 *   .irb-score-key, .irb-score-val, .irb-audnum,
 *   .irb-conflict-callout, .irb-conflict-icon
 *
 * Requires the following helpers to be available globally:
 *   esc(), applicantCustomAnswers(), applicantRolePrefLabel(),
 *   applicantConflictDetails(), applicantInRoomScore() (optional),
 *   applicantInRoomNotes() (optional), INROOM_SCORE_OPTIONS (optional),
 *   INROOM_SCORE_LABELS (optional)
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Builds the full back-of-card HTML for a performer.
 *
 * @param {object} app         - Applicant record
 * @param {object} [opts]
 * @param {boolean} [opts.includeInRoomScores=true]  - Show In The Room scoring section if data exists
 * @param {boolean} [opts.includeRoomNotes=true]      - Show room notes section if data exists
 * @returns {string} HTML string — wrap in .inroom-back-scroll or equivalent
 */
function buildCastingCardBack(app, opts = {}) {
  const BACK_CARD_SURFACE_STYLE = [
    'display:flex',
    'flex-direction:column',
    'gap:0',
    'width:100%',
    'height:auto',
    'aspect-ratio:4 / 5',
    'padding:0',
    'box-sizing:border-box',
    'overflow-y:auto',
    'background:#fdfdfd',
    'border-radius:4px',
    'box-shadow:-3px -3px 0 rgba(255,255,255,0.78), 0 14px 30px rgba(15,23,42,0.34), 18px 26px 42px rgba(15,23,42,0.28), 0 3px 10px rgba(15,23,42,0.18)'
  ].join(';');
  const {
    includeInRoomScores = true,
    includeRoomNotes    = true,
    scoreColorSet       = null,
    sessionNotes        = null,  // array of { label, note } — one per audition session
    bucketPlacements      = null,  // array of { sessionLabel, bucketName, bucketColour } — dance call container placements
    roleNotes             = null,  // array of { charName, roleType, note } — per-character in-room notes
    characterAssignments  = null,  // array of { charName, roleType, state, decision } — casting board placements
  } = opts;

  const ca = (typeof applicantCustomAnswers === 'function')
    ? applicantCustomAnswers(app)
    : ((typeof app.custom_answers === 'string')
        ? JSON.parse(app.custom_answers || '{}')
        : (app.custom_answers || {}));

  // ── Helpers ──────────────────────────────────────────────────
  function escStr(str) {
    if (typeof esc === 'function') return esc(str);
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  let sectionIndex = 0;
  function section(label, rows) {
    const filtered = rows.filter(([, v]) => v && String(v).trim() && v !== '—');
    if (!filtered.length) return '';
    const sectionBg = sectionIndex++ % 2 === 0 ? '#fdfdfd' : '#e0e0e0';
    return `<div class="irb-section" style="border-left-color:${sectionBg};background:${sectionBg};">
      <div class="irb-section-label">${escStr(label)}</div>
      <div class="irb-section-rows">
        ${filtered.map(([k, v]) =>
          `<div class="irb-row"><span class="irb-row-key">${escStr(k)}</span><span class="irb-row-val">${escStr(String(v))}</span></div>`
        ).join('')}
      </div>
    </div>`;
  }

  function tabButton(label, isActive, panelId) {
    return `<button type="button" class="irb-tab${isActive ? ' is-active' : ''}" aria-selected="${isActive ? 'true' : 'false'}" onclick="(function(btn){const wrap=btn.closest('.irb-tabs'); if(!wrap) return; wrap.querySelectorAll('.irb-tab').forEach(tab=>{tab.classList.remove('is-active');tab.setAttribute('aria-selected','false');}); wrap.querySelectorAll('.irb-tab-panel').forEach(panel=>panel.hidden=true); btn.classList.add('is-active'); btn.setAttribute('aria-selected','true'); const panel=wrap.querySelector('#'+btn.getAttribute('data-panel')); if(panel) panel.hidden=false;})(this)" data-panel="${escStr(panelId)}">${escStr(label)}</button>`;
  }

  function tabPanel(id, content, isActive) {
    return `<section class="irb-tab-panel" id="${escStr(id)}"${isActive ? '' : ' hidden'}>${content || '<div class="irb-tab-empty">Nothing here yet.</div>'}</section>`;
  }

  function entryMatchesSessionType(entry, type) {
    return String(entry?.sessionType || '').toLowerCase() === String(type || '').toLowerCase();
  }

  function renderSessionAssignments(entries) {
    if (!entries?.length) return '';
    const stateLabel = { liked: 'Considered', chosen: 'Cast', applied: 'Applied' };
    const stateColour = { liked: '#572e88', chosen: '#b07a00', applied: '#7a7490' };
    const decisionLabel = { yes: 'Yes', maybe: 'Maybe', no: 'No' };
    const decisionColour = { yes: '#2f7a4a', maybe: '#c89118', no: '#9a4a4a' };
    return `<div class="irb-session-block">
      <div class="irb-session-label">Casting Board</div>
      ${entries.map(({ sessionLabel, charName, roleType, state, decision }) => {
        const col = decisionColour[decision] || stateColour[state] || '#572e88';
        const lbl = decisionLabel[decision] || stateLabel[state] || state;
        return `<div class="irb-inroom-chars-row">
          <span class="irb-inroom-chars-name">${sessionLabel ? `<span style="display:block;font-size:0.75em;font-weight:700;opacity:0.7;">${escStr(sessionLabel)}</span>` : ''}${escStr(charName)}${roleType === 'Group' ? ' <span style="opacity:0.65;font-size:0.85em;">(group)</span>' : ''}</span>
          <span class="irb-inroom-chars-state" style="color:${col};">${escStr(lbl)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderSessionBuckets(entries) {
    if (!entries?.length) return '';
    return entries.map(({ sessionLabel, bucketName, bucketColour }) =>
      `<div class="irb-inroom-bucket-block" style="border-left-color:${escStr(bucketColour)};background:${escStr(bucketColour)}12;">
        <div class="irb-inroom-note-label" style="color:${escStr(bucketColour)};">${escStr(sessionLabel)}</div>
        <div class="irb-inroom-bucket-name" style="color:${escStr(bucketColour)};">${escStr(bucketName)}</div>
      </div>`
    ).join('');
  }

  function renderSessionRoleNotes(entries) {
    if (!entries?.length) return '';
    return entries.map(({ sessionLabel, charName, roleType, note, authorColor }) =>
      `<div class="irb-inroom-role-note-block" style="${authorColor ? `border-left-color:${escStr(authorColor)};background:${escStr(authorColor)}12;` : ''}">
        <div class="irb-inroom-role-note-header">
          <span class="irb-inroom-role-note-name">${sessionLabel ? `<span style="display:block;font-size:0.75em;font-weight:700;opacity:0.7;">${escStr(sessionLabel)}</span>` : ''}${escStr(charName)}${roleType === 'Group' ? ' <span style="font-size:0.85em;font-weight:600;opacity:0.65;">(group)</span>' : ''}</span>
          ${roleType && roleType !== 'Group' ? `<span class="irb-inroom-role-note-type">${escStr(roleType)}</span>` : ''}
        </div>
        <div class="irb-notes">${escStr(note)}</div>
      </div>`
    ).join('');
  }

  function renderSessionNotes(entries, heading = '') {
    if (!entries?.length) return '';
    const content = entries.map(({ label, note, authorColor }) =>
      `<div class="irb-inroom-note-block" style="${authorColor ? `border-left-color:${escStr(authorColor)};background:${escStr(authorColor)}12;` : ''}">
        <div class="irb-inroom-note-label" style="${authorColor ? `color:${escStr(authorColor)};` : ''}">${escStr(label)}</div>
        <div class="irb-notes">${escStr(note)}</div>
      </div>`
    ).join('');
    if (!heading) return content;
    return `<div class="irb-session-block">
      <div class="irb-session-label">${escStr(heading)}</div>
      ${content}
    </div>`;
  }

  function renderSessionTabContent(type) {
    const assignmentEntries = (characterAssignments || []).filter(entry => entryMatchesSessionType(entry, type));
    const bucketEntries = (bucketPlacements || []).filter(entry => entryMatchesSessionType(entry, type));
    const roleNoteEntries = (roleNotes || []).filter(entry => entryMatchesSessionType(entry, type));
    const noteEntries = (sessionNotes || []).filter(entry => entryMatchesSessionType(entry, type));
    const content = [
      renderSessionAssignments(assignmentEntries),
      renderSessionBuckets(bucketEntries),
      renderSessionRoleNotes(roleNoteEntries),
      renderSessionNotes(noteEntries, type === 'audition' ? 'Quick Notes' : ''),
    ].filter(Boolean).join('');
    return content || '<div class="irb-tab-empty">Nothing here yet.</div>';
  }

  // Keys already surfaced explicitly — don't repeat in "Other Answers"
  const handledKeys = new Set([
    'Preferred Name', 'Pronouns', 'Date of Birth', 'DOB', 'Birth Date',
    'Contact Name', 'Contact Email', 'Contact Phone',
    'Guardian Name', 'Guardian Contact',
    'Role Gender Preferences', 'Gender of Roles', 'gender_preference', 'Gender Preference',
    'Roles written as girls / women', 'Roles written as boys / men', 'Roles written as non-binary / gender-neutral',
    'Casting Preference', 'Requested Roles', 'Other Roles',
    'Available for all rehearsals?', 'Available for all performances?', 'List any conflicts',
    'Acting Experience Level', 'Acting Experience Details',
    'Vocal Experience Level', 'Vocal Type', 'Vocal Experience Details',
    'Dance / Movement Experience Level', 'Dance Styles', 'Dance / Movement Details',
    'Special Skills', 'Previous Experience', 'Additional Notes',
    'In The Room - Vocals', 'In The Room - Movement', 'In The Room - Acting',
    'In The Room - Direction', 'In The Room - Presence', 'In The Room - Energy', 'In The Room - Notes',
  ]);
  // Also exclude per-session note keys and per-role note keys
  const isHandledKey = key =>
    handledKeys.has(key) ||
    key.startsWith('In The Room - Notes - ') ||
    key.startsWith('In The Room - Role Notes - ') ||
    key.startsWith('In The Room - Considered - ');

  // ── Casting ───────────────────────────────────────────────────
  const castingPref = (typeof applicantRolePrefLabel === 'function') ? applicantRolePrefLabel(app) : '';
  const attendanceModeLabel = app?.attendance_mode === 'in_person' ? 'In Person'
    : app?.attendance_mode === 'video_call' ? 'Video Call'
    : null;
  const castingSection = section('Casting', [
    ['Role Openness', castingPref],
    ['Joining', attendanceModeLabel],
  ]);

  // ── Acting ────────────────────────────────────────────────────
  const actingSection = section('Acting', [
    ['Level',   ca['Acting Experience Level']],
    ['Details', ca['Acting Experience Details']],
  ].filter(([, v]) => v));

  // ── Vocals ────────────────────────────────────────────────────
  const vocalSection = section('Vocals', [
    ['Level',      ca['Vocal Experience Level']],
    ['Voice Type', ca['Vocal Type']],
    ['Details',    ca['Vocal Experience Details']],
  ].filter(([, v]) => v));

  // ── Dance ─────────────────────────────────────────────────────
  const danceSection = section('Dance', [
    ['Level',   ca['Dance / Movement Experience Level']],
    ['Styles',  ca['Dance Styles']],
    ['Details', ca['Dance / Movement Details']],
  ].filter(([, v]) => v));

  // ── Skills & Experience ───────────────────────────────────────
  const skillsSection = section('Skills & Experience', [
    ['Special Skills',       ca['Special Skills'] || app.skills],
    ['Previous Experience',  ca['Previous Experience'] || app.experience],
  ].filter(([, v]) => v));

  // ── Conflicts (schedule + conflicts together) ────────────────
  const availabilityRows = [
    ['All Rehearsals',   (() => { const v = ca['Available for all rehearsals?'];   if (v === true  || v === 'true')  return 'Yes'; if (v === false || v === 'false') return 'No'; return null; })()],
    ['All Performances', (() => { const v = ca['Available for all performances?']; if (v === true  || v === 'true')  return 'Yes'; if (v === false || v === 'false') return 'No'; return null; })()],
  ];

  // Add conflict dates into the compact conflicts section.
  const rawConflicts = app?.date_conflicts;
  const conflictsObj = typeof rawConflicts === 'string'
    ? (() => { try { return JSON.parse(rawConflicts || '{}') || {}; } catch { return {}; } })()
    : (rawConflicts || {});
  const conflictEntries = Object.entries(conflictsObj || {})
    .filter(([, v]) => v && (v === true || v.conflict === true || v === 'true'));

  function fmtConflictDate(dateStr) {
    if (!dateStr) return '';
    try {
      const [y, m, d] = String(dateStr).split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return String(dateStr); }
  }

  const conflictRows = conflictEntries.map(([, v], index) => {
    if (typeof v === 'object' && v !== null) {
      const dateStr = v.date ? fmtConflictDate(v.date) : null;
      const title   = v.title || null;
      if (dateStr && title)  return [`Conflict ${index + 1}`, `${dateStr} — ${title}`];
      if (dateStr)           return [`Conflict ${index + 1}`, dateStr];
      if (title)             return [`Conflict ${index + 1}`, title];
    }
    return [`Conflict ${index + 1}`, 'Date not recorded'];
  }).filter(([k]) => k);

  // Also include any free-text conflict note.
  const conflictNote = ca['List any conflicts'];
  if (conflictNote) conflictRows.push(['Conflict Notes', conflictNote]);

  availabilityRows.push(...conflictRows);
  const availabilitySection = availabilityRows
    .filter(([, v]) => v)
    .length
    ? section('Conflicts', availabilityRows.filter(([, v]) => v))
    : '';

  // ── Other custom answers ──────────────────────────────────────
  const customRows = Object.entries(ca || {})
    .filter(([key, value]) => !isHandledKey(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      let display;
      if (value === true)             display = 'Yes';
      else if (value === false)       display = 'No';
      else if (Array.isArray(value))  display = value.join(', ');
      else if (typeof value === 'object') display = JSON.stringify(value);
      else display = String(value);
      return [key, display];
    })
    .filter(([, display]) => display && display.trim() && display !== '—');
  const customSection = customRows.length ? section('Other Answers', customRows) : '';

  // ── Notes ─────────────────────────────────────────────────────
  const notesValue = ca['Additional Notes'] || app.notes;
  const notesSection = notesValue
    ? (() => {
        const notesBg = sectionIndex++ % 2 === 0 ? '#fdfdfd' : '#e0e0e0';
        return `<div class="irb-section" style="border-left-color:${notesBg};background:${notesBg};">
         <div class="irb-section-label">Notes</div>
         <div class="irb-section-rows"><div class="irb-notes">${escStr(notesValue)}</div></div>
       </div>`;
      })()
    : '';

  const theirAnswersContent = [
    castingSection,
    actingSection,
    vocalSection,
    danceSection,
    skillsSection,
    availabilitySection,
    customSection,
    notesSection,
  ].filter(Boolean).join('') || '<div class="irb-tab-empty">Nothing here yet.</div>';

  let generalAuditionsContent = '';
  let danceCallContent = '';
  let callbackContent = '';

  if (includeInRoomScores || includeRoomNotes) {
    if (includeInRoomScores
      && typeof applicantInRoomScore === 'function'
      && typeof INROOM_SCORE_OPTIONS !== 'undefined'
      && typeof INROOM_SCORE_LABELS !== 'undefined') {
      const scoreRows = Object.keys(INROOM_SCORE_OPTIONS)
        .map(key => [INROOM_SCORE_LABELS[key], applicantInRoomScore(app, key)])
        .filter(([, value]) => value);
      if (scoreRows.length) {
        const scoreBlockStyle = scoreColorSet
          ? `style="background:${escStr(scoreColorSet.light)};border-left:3px solid ${escStr(scoreColorSet.base)};padding:0.45rem 0.5rem;border-radius:0 6px 6px 0;"`
          : '';
        const scoreLabelStyle = scoreColorSet
          ? `style="color:${escStr(scoreColorSet.dark)};"`
          : '';
        const scoreKeyStyle = scoreColorSet
          ? `style="color:${escStr(scoreColorSet.dark)};opacity:0.72;"`
          : '';
        const scoreValStyle = scoreColorSet
          ? `style="color:${escStr(scoreColorSet.dark)};"`
          : '';
        generalAuditionsContent += `<div class="irb-session-block irb-inroom-scores" ${scoreBlockStyle}>
          <div class="irb-session-label" ${scoreLabelStyle}>Impressions</div>
          <div class="irb-score-grid">${scoreRows.map(([label, value]) =>
            `<div class="irb-score-pair"><span class="irb-score-key" ${scoreKeyStyle}>${escStr(label)}</span><span class="irb-score-val" ${scoreValStyle}>${escStr(value)}</span></div>`
          ).join('')}</div>
        </div>`;
      }
    }

    generalAuditionsContent += renderSessionTabContent('audition');
    danceCallContent += renderSessionTabContent('dance_call');
    callbackContent += renderSessionTabContent('callback');

    if (!sessionNotes?.length && typeof applicantInRoomNotes === 'function') {
      const roomNotes = applicantInRoomNotes(app);
      if (roomNotes) {
        generalAuditionsContent += `<div class="irb-inroom-note-block">
          <div class="irb-notes">${escStr(roomNotes)}</div>
        </div>`;
      }
    }
  }

  return `<div class="inroom-back-scroll irb-tabs" style="${BACK_CARD_SURFACE_STYLE}">
    <div class="irb-tab-bar" role="tablist" aria-label="Casting card details">
      ${tabButton('Their Answers', true, 'irb-tab-answers')}
      ${tabButton('General Auditions', false, 'irb-tab-general')}
      ${tabButton('Dance Call', false, 'irb-tab-dance')}
      ${tabButton('Callback', false, 'irb-tab-callback')}
    </div>
    ${tabPanel('irb-tab-answers', theirAnswersContent, true)}
    ${tabPanel('irb-tab-general', generalAuditionsContent, false)}
    ${tabPanel('irb-tab-dance', danceCallContent, false)}
    ${tabPanel('irb-tab-callback', callbackContent, false)}
  </div>`;
}
