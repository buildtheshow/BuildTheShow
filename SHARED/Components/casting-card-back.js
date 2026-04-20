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
  const {
    includeInRoomScores = true,
    includeRoomNotes    = true,
    accentColor         = null,  // if set, all sections use this color instead of per-category rainbow
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

  function section(label, rows, color) {
    const filtered = rows.filter(([, v]) => v && String(v).trim() && v !== '—');
    if (!filtered.length) return '';
    return `<div class="irb-section" style="border-left-color:${color};background:${color}66;">
      <div class="irb-section-label">${escStr(label)}</div>
      <div class="irb-section-rows">
        ${filtered.map(([k, v]) =>
          `<div class="irb-row"><span class="irb-row-key">${escStr(k)}</span><span class="irb-row-val">${escStr(String(v))}</span></div>`
        ).join('')}
      </div>
    </div>`;
  }

  // ── Section colours ───────────────────────────────────────────
  // If accentColor is provided (e.g. session type colour), all sections use it.
  // Otherwise each section gets its own colour for visual distinction.
  const C = accentColor ? {
    casting:      accentColor,
    acting:       accentColor,
    vocals:       accentColor,
    dance:        accentColor,
    skills:       accentColor,
    availability: accentColor,
    other:        accentColor,
    notes:        accentColor,
    inroom:       accentColor,
    roomnotes:    accentColor,
  } : {
    casting:      '#a87af8',
    acting:       '#55acda',
    vocals:       '#4ab847',
    dance:        '#ef7d05',
    skills:       '#ffdd68',
    availability: '#f03592',
    other:        '#ff7db4',
    notes:        '#22cdd4',
    inroom:       '#7b7b7b',
    roomnotes:    '#22cdd4',
  };

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
  ], C.casting);

  // ── Acting ────────────────────────────────────────────────────
  const actingSection = section('Acting', [
    ['Level',   ca['Acting Experience Level']],
    ['Details', ca['Acting Experience Details']],
  ].filter(([, v]) => v), C.acting);

  // ── Vocals ────────────────────────────────────────────────────
  const vocalSection = section('Vocals', [
    ['Level',      ca['Vocal Experience Level']],
    ['Voice Type', ca['Vocal Type']],
    ['Details',    ca['Vocal Experience Details']],
  ].filter(([, v]) => v), C.vocals);

  // ── Dance ─────────────────────────────────────────────────────
  const danceSection = section('Dance', [
    ['Level',   ca['Dance / Movement Experience Level']],
    ['Styles',  ca['Dance Styles']],
    ['Details', ca['Dance / Movement Details']],
  ].filter(([, v]) => v), C.dance);

  // ── Skills & Experience ───────────────────────────────────────
  const skillsSection = section('Skills & Experience', [
    ['Special Skills',       ca['Special Skills'] || app.skills],
    ['Previous Experience',  ca['Previous Experience'] || app.experience],
  ].filter(([, v]) => v), C.skills);

  // ── Availability (yes/no scheduling questions) ───────────────
  const availabilityRows = [
    ['All Rehearsals',   (() => { const v = ca['Available for all rehearsals?'];   if (v === true  || v === 'true')  return 'Yes'; if (v === false || v === 'false') return 'No'; return null; })()],
    ['All Performances', (() => { const v = ca['Available for all performances?']; if (v === true  || v === 'true')  return 'Yes'; if (v === false || v === 'false') return 'No'; return null; })()],
  ].filter(([, v]) => v);
  const availabilitySection = availabilityRows.length ? section('Availability', availabilityRows, C.availability) : '';

  // ── Conflicts (individual dates, own section) ─────────────────
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

  const conflictRows = conflictEntries.map(([, v]) => {
    if (typeof v === 'object' && v !== null) {
      const dateStr = v.date ? fmtConflictDate(v.date) : null;
      const title   = v.title || null;
      // Left column = date (what day), right column = event name (what it is)
      if (dateStr && title)  return [dateStr, title];
      if (dateStr)           return [dateStr, 'Unavailable'];
      if (title)             return [title,   'Date not recorded'];
    }
    return ['Conflict', 'Date not recorded'];
  }).filter(([k]) => k);

  // Also include any free-text conflict note
  const conflictNote = ca['List any conflicts'];
  if (conflictNote) conflictRows.push(['Notes', conflictNote]);

  const conflictsSection = conflictRows.length ? section('Conflicts', conflictRows, C.availability) : '';

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
  const customSection = customRows.length ? section('Other Answers', customRows, C.other) : '';

  // ── Notes ─────────────────────────────────────────────────────
  const notesValue = ca['Additional Notes'] || app.notes;
  const notesSection = notesValue
    ? `<div class="irb-section" style="border-left-color:${C.notes};background:${C.notes}26;">
         <div class="irb-section-label">Notes</div>
         <div class="irb-section-rows"><div class="irb-notes">${escStr(notesValue)}</div></div>
       </div>`
    : '';

  // ── In The Room zone (optional) ───────────────────────────────
  // Separate visual zone below the application data.
  // Contains: scores grid (flat, one set) + per-session notes.
  let inRoomZone = '';
  if (includeInRoomScores || includeRoomNotes) {
    let inRoomContent = '';

    // Scores
    if (includeInRoomScores
      && typeof applicantInRoomScore === 'function'
      && typeof INROOM_SCORE_OPTIONS !== 'undefined'
      && typeof INROOM_SCORE_LABELS !== 'undefined') {
      const scoreRows = Object.keys(INROOM_SCORE_OPTIONS)
        .map(key => [INROOM_SCORE_LABELS[key], applicantInRoomScore(app, key)])
        .filter(([, value]) => value);
      if (scoreRows.length) {
        inRoomContent += `<div class="irb-inroom-scores">
          <div class="irb-score-grid">${scoreRows.map(([label, value]) =>
            `<div class="irb-score-pair"><span class="irb-score-key">${escStr(label)}</span><span class="irb-score-val">${escStr(value)}</span></div>`
          ).join('')}</div>
        </div>`;
      }
    }

    // Casting board character assignments (liked / chosen)
    if (characterAssignments && characterAssignments.length) {
      const stateLabel = { liked: 'Considered', chosen: 'Cast', applied: 'Applied' };
      const stateColour = { liked: '#572e88', chosen: '#b07a00', applied: '#7a7490' };
      const decisionLabel = { yes: 'Yes', maybe: 'Maybe', no: 'No' };
      const decisionColour = { yes: '#2f7a4a', maybe: '#c89118', no: '#9a4a4a' };
      inRoomContent += `<div class="irb-inroom-chars-block">
        <div class="irb-inroom-note-label" style="color:#572e88;">Casting Board</div>
        ${characterAssignments.map(({ sessionLabel, charName, roleType, state, decision }) => {
          const col = decisionColour[decision] || stateColour[state] || '#572e88';
          const lbl = decisionLabel[decision] || stateLabel[state] || state;
          return `<div class="irb-inroom-chars-row">
            <span class="irb-inroom-chars-name">${sessionLabel ? `<span style="display:block;font-size:0.75em;font-weight:700;opacity:0.7;">${escStr(sessionLabel)}</span>` : ''}${escStr(charName)}${roleType === 'Group' ? ' <span style="opacity:0.65;font-size:0.85em;">(group)</span>' : ''}</span>
            <span class="irb-inroom-chars-state" style="color:${col};">${escStr(lbl)}</span>
          </div>`;
        }).join('')}
      </div>`;
    }

    // Dance call bucket placements (one chip per session they were sorted into a container)
    if (bucketPlacements && bucketPlacements.length) {
      inRoomContent += bucketPlacements.map(({ sessionLabel, bucketName, bucketColour }) =>
        `<div class="irb-inroom-bucket-block" style="border-left-color:${escStr(bucketColour)};background:${escStr(bucketColour)}12;">
          <div class="irb-inroom-note-label" style="color:${escStr(bucketColour)};">${escStr(sessionLabel)}</div>
          <div class="irb-inroom-bucket-name" style="color:${escStr(bucketColour)};">${escStr(bucketName)}</div>
        </div>`
      ).join('');
    }

    // Per-character role notes (one block per character with notes)
    if (roleNotes && roleNotes.length) {
      inRoomContent += roleNotes.map(({ sessionLabel, charName, roleType, note }) =>
        `<div class="irb-inroom-role-note-block">
          <div class="irb-inroom-role-note-header">
            <span class="irb-inroom-role-note-name">${sessionLabel ? `<span style="display:block;font-size:0.75em;font-weight:700;opacity:0.7;">${escStr(sessionLabel)}</span>` : ''}${escStr(charName)}${roleType === 'Group' ? ' <span style="font-size:0.85em;font-weight:600;opacity:0.65;">(group)</span>' : ''}</span>
            ${roleType && roleType !== 'Group' ? `<span class="irb-inroom-role-note-type">${escStr(roleType)}</span>` : ''}
          </div>
          <div class="irb-notes">${escStr(note)}</div>
        </div>`
      ).join('');
    }

    // Per-session notes (one block per session that has notes)
    if (includeRoomNotes) {
      if (sessionNotes && sessionNotes.length) {
        inRoomContent += sessionNotes.map(({ label, note }) =>
          `<div class="irb-inroom-note-block">
            <div class="irb-inroom-note-label">${escStr(label)}</div>
            <div class="irb-notes">${escStr(note)}</div>
          </div>`
        ).join('');
      } else if (typeof applicantInRoomNotes === 'function') {
        const roomNotes = applicantInRoomNotes(app);
        if (roomNotes) {
          inRoomContent += `<div class="irb-inroom-note-block">
            <div class="irb-notes">${escStr(roomNotes)}</div>
          </div>`;
        }
      }
    }

    inRoomZone = `<div class="irb-inroom-zone">
      <div class="irb-inroom-zone-header">⬥ In The Room</div>
      ${inRoomContent || '<div class="irb-inroom-empty">Nothing recorded yet.</div>'}
    </div>`;
  }

  return `<div class="inroom-back-scroll">
    ${castingSection}
    ${actingSection}
    ${vocalSection}
    ${danceSection}
    ${skillsSection}
    ${availabilitySection}
    ${conflictsSection}
    ${customSection}
    ${notesSection}
    ${inRoomZone}
  </div>`;
}
