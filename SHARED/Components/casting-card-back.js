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
    'height:100%',
    'padding:0',
    'box-sizing:border-box',
    'overflow:hidden',
    'background:#fdfdfd',
    'border-radius:4px',
    'box-shadow:-3px -3px 0 rgba(255,255,255,0.78), 0 14px 30px rgba(15,23,42,0.34), 18px 26px 42px rgba(15,23,42,0.28), 0 3px 10px rgba(15,23,42,0.18)'
  ].join(';');
  const {
    includeInRoomScores = true,
    includeRoomNotes    = true,
    scoreColorSet       = null,
    sessionNotes        = null,        // array of { label, note } — one per audition session
    scoreObservations   = null,        // array of { sessionLabel, sessionType, label, value, authorName, authorRole, authorColor }
    impressionCategories = null,       // string[] — all expected score category labels; shows all with — for missing
    bucketPlacements      = null,      // array of { sessionLabel, bucketName, bucketColour } — dance call container placements
    roleNotes             = null,      // array of { charName, roleType, note } — per-character in-room notes
    characterAssignments  = null,      // array of { charName, roleType, state, decision } — casting board placements
    auditionTimeRows      = null,      // array of [audition type label, booked time or "-"]
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
  function sectionLabelHtml(label) {
    const chunks = String(label || '').trim().split(/\s+/).filter(Boolean);
    if (chunks.length < 2) return escStr(label);
    const splitAt = Math.max(1, chunks.length - 1);
    const firstLine = chunks.slice(0, splitAt).join(' ');
    const secondLine = chunks.slice(splitAt).join(' ');
    return `<span class="irb-section-label-stack"><span>${escStr(firstLine)}</span><span>${escStr(secondLine)}</span></span>`;
  }

  function section(label, rows) {
    const filtered = rows.filter(([, v]) => v && String(v).trim() && v !== '—');
    if (!filtered.length) return '';
    const sectionBg = sectionIndex++ % 2 === 0 ? '#fdfdfd' : '#e0e0e0';
    const labelHtml = sectionLabelHtml(label);
    return `<div class="irb-section" style="border-left-color:${sectionBg};background:${sectionBg};">
      <div class="irb-section-label">${labelHtml}</div>
      <div class="irb-section-rows">
        ${filtered.map(([k, v]) =>
          `<div class="irb-row"><span class="irb-row-key">${escStr(k)}</span><span class="irb-row-val">${escStr(String(v))}</span></div>`
        ).join('')}
      </div>
    </div>`;
  }

  function tabButton(label, isActive, panelId) {
    return `<button type="button" class="irb-tab${isActive ? ' is-active' : ''}" aria-selected="${isActive ? 'true' : 'false'}" onclick="(function(event,btn){if(event) event.stopPropagation(); const wrap=btn.closest('.irb-tabs'); if(!wrap) return; wrap.querySelectorAll('.irb-tab').forEach(tab=>{tab.classList.remove('is-active');tab.setAttribute('aria-selected','false');}); wrap.querySelectorAll('.irb-tab-panel').forEach(panel=>panel.hidden=true); btn.classList.add('is-active'); btn.setAttribute('aria-selected','true'); const panel=wrap.querySelector('#'+btn.getAttribute('data-panel')); if(panel) panel.hidden=false;})(event,this)" data-panel="${escStr(panelId)}">${escStr(label)}</button>`;
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
      <div class="irb-session-label">Role Clicks</div>
      ${entries.map(({ sessionLabel, charName, roleType, state, decision, authorName, authorRole, authorColor }) => {
        const col = decisionColour[decision] || stateColour[state] || '#572e88';
        const lbl = decisionLabel[decision] || stateLabel[state] || state;
        const author = [authorName, authorRole].filter(Boolean).join(' · ');
        return `<div class="irb-inroom-chars-row">
          <span class="irb-inroom-chars-name">${sessionLabel ? `<span style="display:block;font-size:0.75em;font-weight:700;opacity:0.7;">${escStr(sessionLabel)}</span>` : ''}${escStr(charName)}${roleType === 'Group' ? ' <span style="opacity:0.65;font-size:0.85em;">(group)</span>' : ''}${author ? `<span style="display:block;font-size:0.75em;font-weight:700;color:${escStr(authorColor || '#7a7490')};">${escStr(author)}</span>` : ''}</span>
          <span class="irb-inroom-chars-state" style="color:${escStr(authorColor || col)};">${escStr(lbl)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderSessionScores(entries, allCategories) {
    if (allCategories?.length) {
      // Build ordered author list (first-seen order = consistent column order)
      const authorOrder = [];
      const authorSet = new Set();
      (entries || []).forEach(entry => {
        const key = [entry.authorName, entry.authorRole, entry.authorColor].join('||');
        if (!authorSet.has(key)) { authorSet.add(key); authorOrder.push({ key, authorColor: entry.authorColor }); }
      });

      // Build category → author-key → value map
      const catMap = new Map(allCategories.map(cat => [cat, new Map()]));
      (entries || []).forEach(entry => {
        const key = [entry.authorName, entry.authorRole, entry.authorColor].join('||');
        catMap.get(entry.label)?.set(key, entry.value);
      });

      const categoriesHtml = allCategories.map(cat => {
        const byAuthor = catMap.get(cat);
        const answers = authorOrder.length
          ? authorOrder.map(({ key, authorColor }) => {
              const val = byAuthor.get(key);
              return `<span class="irb-impression-answer${!val ? ' irb-score-empty' : ''}" style="${authorColor ? `color:${escStr(authorColor)};` : ''}">${val ? escStr(val) : '—'}</span>`;
            }).join('')
          : `<span class="irb-impression-answer irb-score-empty">—</span>`;
        return `<div class="irb-impression-row"><span class="irb-impression-cat">${escStr(cat)}</span>${answers}</div>`;
      }).join('');

      return `<div class="irb-session-block irb-inroom-scores">
        <div class="irb-session-label">Impressions</div>
        <div class="irb-impression-grid">${categoriesHtml}</div>
      </div>`;
    }

    if (!entries?.length) return '';
    return `<div class="irb-session-block irb-inroom-scores">
      <div class="irb-session-label">Impressions</div>
      <div class="irb-score-grid">${entries.map(({ label, value, authorName, authorRole, authorColor }) => {
        const author = [authorName, authorRole].filter(Boolean).join(' · ');
        return `<div class="irb-score-pair" style="${authorColor ? `border-left:3px solid ${escStr(authorColor)};padding-left:0.35rem;` : ''}">
          <span class="irb-score-key" style="${authorColor ? `color:${escStr(authorColor)};` : ''}">${escStr(label)}</span>
          <span class="irb-score-val">${escStr(value)}</span>
          ${author ? `<span class="irb-inroom-note-label" style="${authorColor ? `color:${escStr(authorColor)};` : ''}">${escStr(author)}</span>` : ''}
        </div>`;
      }).join('')}</div>
    </div>`;
  }

  function renderSessionBuckets(entries) {
    if (!entries?.length) return '';
    const rows = entries.map(({ bucketName, bucketColour }) =>
      `<div class="irb-char-name" style="${bucketColour ? `color:${escStr(bucketColour)};` : ''}">${escStr(bucketName)}</div>`
    ).join('');
    return `<div class="irb-session-block">
      <div class="irb-session-label">Groups</div>
      ${rows}
    </div>`;
  }

  function renderSessionRoleNotes(entries) {
    if (!entries?.length) return '';
    return entries.map(({ sessionLabel, charName, roleType, note, authorName, authorRole, authorColor }) =>
      `<div class="irb-inroom-role-note-block" style="${authorColor ? `border-left-color:${escStr(authorColor)};background:${escStr(authorColor)}12;` : ''}">
        <div class="irb-inroom-role-note-header">
          <span class="irb-inroom-role-note-name">${sessionLabel ? `<span style="display:block;font-size:0.75em;font-weight:700;opacity:0.7;">${escStr(sessionLabel)}</span>` : ''}${escStr(charName)}${roleType === 'Group' ? ' <span style="font-size:0.85em;font-weight:600;opacity:0.65;">(group)</span>' : ''}</span>
          ${roleType && roleType !== 'Group' ? `<span class="irb-inroom-role-note-type">${escStr(roleType)}</span>` : ''}
        </div>
        ${authorName || authorRole ? `<div class="irb-inroom-note-label" style="${authorColor ? `color:${escStr(authorColor)};` : ''}">${escStr([authorName, authorRole].filter(Boolean).join(' · '))}</div>` : ''}
        <div class="irb-notes">${escStr(note)}</div>
      </div>`
    ).join('');
  }

  function renderSessionNotes(entries, heading = '') {
    if (!entries?.length) return '';
    const content = entries
      .filter(e => String(e.note || '').trim())
      .map(({ note, authorColor }) =>
        `<div class="irb-notes" style="${authorColor ? `color:${escStr(authorColor)};` : ''}">${escStr(note)}</div>`
      ).join('');
    if (!content) return '';
    if (!heading) return content;
    return `<div class="irb-session-block">
      <div class="irb-session-label">${escStr(heading)}</div>
      ${content}
    </div>`;
  }

  function renderSessionNotesAlways(entries, heading) {
    const hasContent = entries?.some(e => String(e.note || '').trim());
    if (!hasContent) {
      return `<div class="irb-session-block">
        <div class="irb-session-label">${escStr(heading)}</div>
        <div class="irb-notes irb-score-empty">—</div>
      </div>`;
    }
    return renderSessionNotes(entries, heading);
  }

  function renderCharacterList(entries) {
    if (!entries?.length) {
      return `<div class="irb-session-block">
        <div class="irb-session-label">Characters</div>
        <div class="irb-notes irb-score-empty">—</div>
      </div>`;
    }
    const ROLE_ORDER = { Principal: 0, Featured: 1, Supporting: 2, Ensemble: 3, Chorus: 3, Group: 3 };
    const STATE_LABEL = { liked: 'Liked', chosen: 'Cast', applied: 'Applied', decision: '' };
    const DECISION_LABEL = { yes: 'Yes', maybe: 'Maybe', no: 'No' };
    const sorted = [...entries].sort((a, b) => {
      const ra = ROLE_ORDER[a.roleType] ?? 99, rb = ROLE_ORDER[b.roleType] ?? 99;
      if (ra !== rb) return ra - rb;
      return (a.charName || '').localeCompare(b.charName || '');
    });
    const groups = [];
    let current = null;
    sorted.forEach(entry => {
      const type = entry.roleType || 'Other';
      if (!current || current.type !== type) { current = { type, entries: [] }; groups.push(current); }
      current.entries.push(entry);
    });
    const inner = groups.map(({ type, entries: grpEntries }) => {
      const rows = grpEntries.map(({ charName, state, decision, authorColor }) => {
        const badge = DECISION_LABEL[decision] || STATE_LABEL[state] || '';
        return `<div class="irb-char-row">
          <span class="irb-char-name" style="${authorColor ? `color:${escStr(authorColor)};` : ''}">${escStr(charName)}</span>
          ${badge ? `<span class="irb-char-badge" style="${authorColor ? `color:${escStr(authorColor)};border-color:${escStr(authorColor)};` : ''}">${escStr(badge)}</span>` : ''}
        </div>`;
      }).join('');
      return `<div class="irb-char-group">
        <div class="irb-char-group-label">${escStr(type)}</div>
        ${rows}
      </div>`;
    }).join('');
    return `<div class="irb-session-block">
      <div class="irb-session-label">Characters</div>
      ${inner}
    </div>`;
  }

  function renderSessionTabContent(type) {
    const scoreEntries      = (scoreObservations   || []).filter(entry => entryMatchesSessionType(entry, type));
    const assignmentEntries = (characterAssignments || []).filter(entry => entryMatchesSessionType(entry, type));
    const bucketEntries     = (bucketPlacements     || []).filter(entry => entryMatchesSessionType(entry, type));
    const roleNoteEntries   = (roleNotes            || []).filter(entry => entryMatchesSessionType(entry, type));
    const noteEntries       = (sessionNotes         || []).filter(entry => entryMatchesSessionType(entry, type));

    if (type === 'audition') {
      return [
        renderSessionScores(scoreEntries, impressionCategories),
        renderSessionNotesAlways(noteEntries, 'Quick Notes'),
        renderCharacterList(assignmentEntries),
      ].filter(Boolean).join('');
    }

    if (type === 'dance_call') {
      return [
        renderSessionBuckets(bucketEntries),
        renderSessionNotesAlways(noteEntries, 'Quick Notes'),
        renderCharacterList(assignmentEntries),
      ].filter(Boolean).join('');
    }

    const content = [
      renderSessionScores(scoreEntries),
      renderSessionAssignments(assignmentEntries),
      renderSessionBuckets(bucketEntries),
      renderSessionRoleNotes(roleNoteEntries),
      renderSessionNotes(noteEntries, ''),
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

  function formatAnswerValue(value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function isConflictDateKey(key) {
    return /^(conflict dates?|date conflicts?)$/i.test(String(key || '').trim());
  }

  function isAuditionTimeKey(key) {
    const normalized = String(key || '').trim().toLowerCase();
    const hasTimingLanguage = (
      normalized.includes('time') ||
      normalized.includes('slot') ||
      normalized.includes('arrival') ||
      normalized.includes('booking')
    );
    const hasAuditionRound = (
      normalized.includes('audition') ||
      normalized.includes('general') ||
      normalized.includes('dance') ||
      normalized.includes('callback') ||
      normalized.includes('call back') ||
      normalized.includes('call-back')
    );
    return (
      normalized.includes('audition time') ||
      normalized.includes('audition slot') ||
      normalized.includes('general audition') ||
      normalized.includes('dance call') ||
      normalized.includes('callback') ||
      normalized.includes('arrival time') ||
      normalized.includes('time preference') ||
      normalized.includes('preferred time') ||
      normalized.includes('preferred slot') ||
      (hasTimingLanguage && hasAuditionRound)
    );
  }

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
  Object.entries(ca || {})
    .filter(([key, value]) => isConflictDateKey(key) && value !== null && value !== undefined && value !== '')
    .forEach(([, value]) => {
      const display = formatAnswerValue(value);
      if (display && display.trim() && display !== '—') conflictRows.push(['Conflict Dates', display]);
    });

  availabilityRows.push(...conflictRows);
  const availabilitySection = availabilityRows
    .filter(([, v]) => v)
    .length
    ? section('Conflicts', availabilityRows.filter(([, v]) => v))
    : '';

  // ── Other custom answers ──────────────────────────────────────
  const providedAuditionTimeRows = Array.isArray(auditionTimeRows)
    ? auditionTimeRows
      .filter(row => Array.isArray(row) && row.length >= 2)
      .map(([key, value]) => [key, value || '-'])
    : [];
  const customAuditionTimeRows = Object.entries(ca || {})
    .filter(([key, value]) =>
      !isHandledKey(key) &&
      !isConflictDateKey(key) &&
      isAuditionTimeKey(key) &&
      value !== null &&
      value !== undefined &&
      value !== ''
    )
    .map(([key, value]) => {
      const display = formatAnswerValue(value);
      return [key, display];
    })
    .filter(([, display]) => display && display.trim() && display !== '—');
  const customRows = providedAuditionTimeRows.length ? providedAuditionTimeRows : customAuditionTimeRows;
  const customSection = customRows.length ? section('Audition Times', customRows) : '';

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
    notesSection,
    customSection,
  ].filter(Boolean).join('') || '<div class="irb-tab-empty">Nothing here yet.</div>';

  let generalAuditionsContent = '';
  let danceCallContent = '';
  let callbackContent = '';

  if (includeInRoomScores || includeRoomNotes) {
    if ((!scoreObservations || !scoreObservations.length) && includeInRoomScores
      && !impressionCategories
      && typeof applicantInRoomScore === 'function'
      && typeof INROOM_SCORE_OPTIONS !== 'undefined'
      && typeof INROOM_SCORE_LABELS !== 'undefined') {
      const scoreRows = Object.keys(INROOM_SCORE_OPTIONS)
        .map(key => [INROOM_SCORE_LABELS[key], applicantInRoomScore(app, key) || null]);
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
            `<div class="irb-score-pair"><span class="irb-score-key" ${scoreKeyStyle}>${escStr(label)}</span><span class="irb-score-val${!value ? ' irb-score-empty' : ''}" ${scoreValStyle}>${value ? escStr(value) : '—'}</span></div>`
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
