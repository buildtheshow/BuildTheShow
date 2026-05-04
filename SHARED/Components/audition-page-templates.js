(function () {
  const templateRegistry = [];
  const STANDARD_CARD_WRAP_PADDING = '0';
  // Source-of-truth page shell for General Auditions in both workspace and team portal views.
  // Locks the card, impressions, quick notes, and character list structure.
  const LOCKED_GENERAL_IN_ROOM_TEMPLATE_ID = 'auditions.in-room.general';

  function normalizeTags(tags = {}) {
    return Object.entries(tags).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') acc[key] = String(value);
      return acc;
    }, {});
  }

  function registerTemplate(template) {
    if (!template?.id || typeof template.render !== 'function') return;
    const next = Object.assign({}, template, {
      tags: normalizeTags(template.tags),
      priority: Number.isFinite(template.priority) ? template.priority : 0
    });
    const existingIndex = templateRegistry.findIndex(item => item.id === next.id);
    if (existingIndex >= 0) templateRegistry.splice(existingIndex, 1, next);
    else templateRegistry.push(next);
    templateRegistry.sort((a, b) => b.priority - a.priority);
  }

  function templateScore(template, queryTags) {
    const exactKeys = ['component', 'portal'];
    for (const key of exactKeys) {
      if (queryTags[key] && template.tags?.[key] !== queryTags[key]) return -1;
    }
    let score = template.priority || 0;
    for (const [key, value] of Object.entries(template.tags || {})) {
      if (queryTags[key] !== value) return -1;
      score += 10;
    }
    return score;
  }

  function findTemplate(query = {}) {
    const queryTags = normalizeTags(query);
    let best = null;
    let bestScore = -1;
    for (const template of templateRegistry) {
      const score = templateScore(template, queryTags);
      if (score > bestScore) {
        best = template;
        bestScore = score;
      }
    }
    return best;
  }

  function renderTemplate(query, config) {
    const template = findTemplate(query);
    if (!template) return '';
    return template.render(config);
  }

  function renderTemplateById(id, config) {
    const template = templateRegistry.find(item => item.id === id);
    if (!template) return '';
    return template.render(config);
  }

  function renderRoleTypeOptions(roleTypeOptions, esc) {
    return roleTypeOptions.map(rt => `<option value="${esc(rt)}">${esc(rt)}</option>`).join('');
  }

  function renderStickyNoteTemplate(config) {
    const {
      esc,
      appId = '',
      charId = '',
      name = 'Unnamed',
      stateClass = '',
      variant = 'body',
      namePlacement = variant,
      roleType = '',
      subtitle = roleType,
      bodyText = '',
      bodyHtml = ''
    } = config;
    const placement = namePlacement === 'header' ? 'header' : 'body';
    const safeAppId = esc(appId);
    const safeCharId = esc(charId);
    const safeName = esc(name);
    const safeSubtitle = esc(subtitle);
    const safeBodyText = esc(bodyText);
    const safeStateClass = esc(stateClass).trim();
    const className = ['inroom-role-chip', `inroom-role-chip--${placement}`, safeStateClass]
      .filter(Boolean)
      .join(' ');
    const resolvedBodyHtml = bodyHtml || [
      safeSubtitle ? `<div class="inroom-role-chip-body-kicker">${safeSubtitle}</div>` : '',
      safeBodyText ? `<div class="inroom-role-chip-body-copy">${safeBodyText}</div>` : ''
    ].filter(Boolean).join('');

    const contentHtml = placement === 'header'
      ? `<div class="inroom-role-chip-header"><div class="inroom-role-chip-header-title">${safeName}</div></div>
        <div class="inroom-role-chip-body">${resolvedBodyHtml}</div>`
      : `<div class="inroom-role-chip-title">${safeName}</div>`;

    return `<button type="button" class="${className}" data-app-id="${safeAppId}" data-char-id="${safeCharId}" onclick="toggleInRoomRole(this,'${safeAppId}','${safeCharId}')">
        ${contentHtml}
      </button>`;
  }

  function renderCastingBoardStickyNoteTemplate(config) {
    const {
      esc,
      noteId = '',
      charId = '',
      name = 'Unnamed',
      style = '',
      cardsId = '',
      cardsHtml = '',
      footerId = '',
      footerHtml = '',
      interactive = true,
      headerOnclick = '',
      noteOnclick = '',
      dragAttrs = ''
    } = config;
    const safeCharId = esc(charId);
    const safeNoteId = esc(noteId || `cbnote-${charId}`);
    const safeCardsId = esc(cardsId || `cbnote-cards-${charId}`);
    const safeFooterId = esc(footerId || `cbnote-footer-${charId}`);
    const safeName = esc(name);
    const safeStyle = String(style || '').replace(/"/g, '&quot;');
    const resolvedNoteOnclick = noteOnclick || (interactive ? `cbv2TouchPlaceOnNote(event,'${safeCharId}')` : '');

    return `<div class="cbv2-role-note" id="${safeNoteId}" data-cbv2-char-id="${safeCharId}"
      ${resolvedNoteOnclick ? `onclick="${resolvedNoteOnclick}"` : ''}
      style="${safeStyle}"${dragAttrs || ''}>
      <div class="cbv2-note-header" ${headerOnclick ? `onclick="${headerOnclick}"` : ''}><span class="cbv2-note-header-label">${safeName}</span></div>
      <div class="cbv2-note-cards" id="${safeCardsId}">
        ${cardsHtml || '<div class="cbv2-note-empty">Drop here</div>'}
      </div>
      <div class="cbv2-note-footer" id="${safeFooterId}">
        ${footerHtml || ''}
      </div>
    </div>`;
  }

  function renderCharacterListHintTemplate() {
    return `<div class="inroom-save-hint">Gold: their choice<br>Your colour: your choice</div>`;
  }

  function renderCharacterListTemplate(config) {
    const {
      esc,
      roleTypeOptions = [],
      roleChipsHtml = ''
    } = config;

    return `<div class="inroom-roles-card inroom-bottom-roles">
          <div class="inroom-roles-header">
            <div class="inroom-roles-title">Character List</div>
            <div class="inroom-roles-controls">
              <select id="inroom-role-filter" class="inroom-roles-select" onchange="filterInRoomRoleChips()">
                <option value="">All roles</option>
                ${renderRoleTypeOptions(roleTypeOptions, esc)}
              </select>
              <select id="inroom-role-sort" class="inroom-roles-select" onchange="filterInRoomRoleChips()">
                <option value="type">By role type</option>
                <option value="az">A - Z</option>
                <option value="za">Z - A</option>
              </select>
            </div>
          </div>
          <div class="inroom-roles-grid" id="inroom-roles-grid">${roleChipsHtml}</div>
          ${renderTemplateById('auditions.character-list.hint', {})}
        </div>`;
  }

  function renderCheckedInStripTemplate(config) {
    const {
      esc,
      label = 'Checked In',
      trayCards = ''
    } = config;

    return `<div class="template-checkin-rail" data-bts-template="checked-in-rail" style="display:grid;grid-template-columns:48px minmax(0,1fr);gap:0.5rem;align-items:stretch;min-width:0;border-radius:0 0 16px 16px;background:#fff;padding:0.55rem 0.65rem 0.75rem;overflow:hidden;">
      <div class="template-checkin-label">${esc(label)}</div>
      <div class="template-checkin-row" style="display:flex;flex-direction:row;flex-wrap:nowrap;align-items:flex-start;gap:0.55rem;min-width:0;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:0.05rem 0.1rem 0.45rem;scrollbar-width:thin;-webkit-overflow-scrolling:touch;perspective:900px;">${trayCards}</div>
    </div>`;
  }

  function renderRoomReadyRequestTemplate(config) {
    const {
      esc,
      roomKey = '',
      title = '',
      nextName = 'the next performer',
      dismissOnclick = '',
      sentOnclick = ''
    } = config;
    const safeRoomKey = esc(roomKey);
    const safeDismissOnclick = String(dismissOnclick || `dismissInRoomReadySignal('${safeRoomKey}')`).replace(/"/g, '&quot;');
    const safeSentOnclick = String(sentOnclick || `markNextPerformerSentIn('${safeRoomKey}')`).replace(/"/g, '&quot;');

    return `<div class="inroom-next-request" id="inroom-next-request-${safeRoomKey}">
      <div class="inroom-next-request-title">${esc(title)}</div>
      <div class="inroom-next-request-body">
        Send in <strong>${esc(nextName)}</strong>.
      </div>
      <div class="inroom-next-request-actions">
        <button type="button" onclick="${safeDismissOnclick}">Dismiss</button>
        <button type="button" class="primary" onclick="${safeSentOnclick}">Sent In</button>
      </div>
    </div>`;
  }

  function renderPortalLoginTemplate(config) {
    const { esc, message = '' } = config;
    return `
      <style>
        #team-access-login-overlay { position:fixed; inset:0; z-index:9999; background:linear-gradient(160deg,#1f1138 0%,#3d1d6e 50%,#572e88 100%); display:flex; align-items:center; justify-content:center; padding:1.5rem; }
        .team-access-login-card { width:min(420px,100%); background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 28px 70px rgba(15,6,35,0.45); }
        .team-access-login-head { background:#572e88; padding:1.25rem 1.5rem; position:relative; overflow:hidden; }
        .team-access-login-head::before { content:''; position:absolute; inset:0; background-image:url('/ASSETS/Images/Grid-Glow-Purple.png'); background-size:cover; opacity:0.07; pointer-events:none; }
        .team-access-login-logo { height:22px; display:block; position:relative; z-index:1; margin-bottom:0.7rem; }
        .team-access-login-label { font-size:0.68rem; font-weight:900; letter-spacing: var(--bts-tracking-label); text-transform:uppercase; color:rgba(255,255,255,0.55); position:relative; z-index:1; }
        .team-access-login-body { padding:1.5rem; }
        .team-access-login-body h1 { margin:0 0 0.3rem; font-size:1.45rem; font-weight:950; letter-spacing: 0; color:#1a1530; }
        .team-access-login-body p { color:#6a5a80; margin:0 0 1.1rem; line-height:1.5; font-size:0.88rem; }
        .team-access-login-error { color:#b91c1c; font-size:0.82rem; font-weight:800; margin-top:0.55rem; min-height:1.2em; }
      </style>
      <div class="team-access-login-card">
        <div class="team-access-login-head">
          <img src="/ASSETS/Images/logo-long-white.png" alt="Build The Show" class="team-access-login-logo" />
          <div class="team-access-login-label">Audition Team Access</div>
        </div>
        <div class="team-access-login-body">
          <h1>Welcome</h1>
          <p>Enter the email address and 6-digit access code from your invite.</p>
          <input class="form-input" id="team-access-email" placeholder="Your email address" type="email" autocomplete="email" />
          <input class="form-input" id="team-access-passcode" placeholder="6-digit access code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" style="margin-top:0.55rem;" />
          <button class="btn-primary" onclick="loginTeamAccess()" style="width:100%;justify-content:center;margin-top:0.85rem;">Open Auditions</button>
          <div class="team-access-login-error" id="team-access-login-error">${esc(message)}</div>
        </div>
      </div>`;
  }

  function renderPortalSessionFrameTemplate(config) {
    const {
      esc,
      headerAccent,
      teamAccessMode,
      activeTool,
      ciClick,
      irClick,
      stClick
    } = config;

    return `
      <div class="aud-session-topnav" style="--session-accent:${esc(headerAccent)};">
        <div class="aud-day-topnav">
          ${teamAccessMode ? '' : `<button type="button" class="aud-day-topnav-btn${activeTool === 'checkin' ? ' active' : ''}" onclick="${ciClick}">Check In</button>`}
          <button type="button" class="aud-day-topnav-btn${activeTool === 'inroom' ? ' active' : ''}" onclick="${irClick}">In the Room</button>
          ${stClick ? `<button type="button" class="aud-day-topnav-btn${activeTool === 'selftape' ? ' active' : ''}" onclick="${stClick}">Self Tape</button>` : ''}
        </div>
      </div>`;
  }

  function renderEmptyStateTemplate(config) {
    const {
      icon = '',
      title = '',
      message = '',
      className = 'card',
      style = 'text-align:center;padding:4rem 2rem;color:#9a90b0;'
    } = config;

    return `<div class="${className}" style="${style}">
            ${icon ? `<div style="font-size:2rem;margin-bottom:0.75rem;">${icon}</div>` : ''}
            ${title ? `<div style="font-size:0.9rem;font-weight:600;color:#6a5a80;margin-bottom:0.3rem;">${title}</div>` : ''}
            ${message ? `<div style="font-size:0.8rem;">${message}</div>` : ''}
          </div>`;
  }

  function renderCastingCardFlipShellTemplate(config) {
    const {
      shellClass = '',
      id = '',
      flipped = false,
      frontHtml = '',
      backHtml = '',
      frontClick = '',
      backClick = ''
    } = config;

    return `<div class="${shellClass}${flipped ? ' flipped' : ''}"${id ? ` id="${esc(id)}"` : ''} style="width:100%;margin:0 auto;perspective:1400px;overflow:visible;">
      <div class="inroom-flip-inner" style="width:100%;max-width:100%;height:100%;aspect-ratio:4 / 5;min-height:0;">
        <div class="inroom-face front"${frontClick ? ` onclick="${frontClick}"` : ''}>
          <div class="inroom-front-card-wrap" style="display:flex;align-items:flex-start;justify-content:center;padding:${STANDARD_CARD_WRAP_PADDING};width:100%;height:100%;overflow:visible;box-sizing:border-box;">${frontHtml}</div>
        </div>
        <div class="inroom-face back"${backClick ? ` onclick="${backClick}"` : ''}>
          <div class="inroom-back-card-surface" style="width:100%;height:100%;display:flex;align-items:flex-start;justify-content:center;padding:${STANDARD_CARD_WRAP_PADDING};box-sizing:border-box;overflow:visible;">
            ${backHtml}
          </div>
        </div>
      </div>
    </div>`;
  }

  function buildCastingCardBackClickHandler(toggleFnName) {
    const safeToggle = String(toggleFnName || '').replace(/"/g, '&quot;');
    return `(function(event){if(event.target&&event.target.closest('button,a,input,select,textarea,label,[role=&quot;button&quot;],.irb-tab-bar,.irb-tab')){event.stopPropagation();return;}event.stopPropagation();if(typeof window['${safeToggle}']==='function')window['${safeToggle}']();})(event)`;
  }

  function renderDanceCallInRoomTemplate(config) {
    const {
      esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
      app,
      sessionId = '',
      cardFrontHtml = '',
      cardBackHtml = '',
      inRoomFlipOpen = false,
      activeTags,
      activeResponse = null,
      activeCasting = null,
      notesValue = '',
      nextButtonHtml = '',
      accentColor = '#572e88'
    } = config;

    const appId = app?.id || '';
    const safeAppId = esc(appId);
    const safeSessionId = esc(sessionId);

    const tagBtn = (key, label) => {
      const isOn = activeTags instanceof Set ? activeTags.has(key) : false;
      return `<button type="button" class="dc-tag-btn${isOn ? ' is-on' : ''}" onclick="dcToggleTag('${safeAppId}','${safeSessionId}','${key}',this)">${esc(label)}</button>`;
    };

    const snapBtn = (snapKey, value, label) => {
      const current = snapKey === 'response' ? activeResponse : activeCasting;
      const isOn = current === value;
      return `<button type="button" class="dc-snap-btn${isOn ? ' is-on' : ''}" onclick="dcToggleSnap('${safeAppId}','${safeSessionId}','${snapKey}','${value}',this)">${esc(label)}</button>`;
    };

    return `<div class="dc-inroom-sheet" style="--dc-sheet-accent:${esc(accentColor)};">
      <div class="dc-inroom-top">
        <div class="dc-inroom-card-col">
          ${renderCastingCardFlipShellTemplate({
            shellClass: 'inroom-flip',
            id: 'inroom-flip-card',
            flipped: inRoomFlipOpen,
            frontHtml: cardFrontHtml,
            backHtml: cardBackHtml,
            frontClick: 'toggleInRoomFlip()',
            backClick: buildCastingCardBackClickHandler('toggleInRoomFlip')
          })}
        </div>
        <div class="dc-inroom-impressions-col">
          <div class="dc-inroom-section-label">Quick Impressions</div>
          <div class="dc-tag-grid">
            ${tagBtn('picks_up', 'Picks Up Quickly')}${tagBtn('clean', 'Clean')}${tagBtn('strong_presence', 'Strong Presence')}${tagBtn('takes_direction', 'Takes Direction')}
          </div>
          <div class="dc-tag-grid dc-tag-grid-neg">
            ${tagBtn('missed_timing', 'Missed Timing')}${tagBtn('needs_support', 'Needs Support')}${tagBtn('low_presence', 'Low Presence')}${tagBtn('unsure', 'Unsure')}
          </div>
        </div>
      </div>
      <div class="dc-inroom-mid">
        <div class="dc-inroom-snap-col">
          <div class="dc-inroom-section-label">Progression</div>
          ${snapBtn('response', 'no_change', 'No Change')}
          ${snapBtn('response', 'tried', 'Tried')}
          ${snapBtn('response', 'adjusted', 'Adjusted')}
          ${snapBtn('response', 'got_it', 'Got It')}
        </div>
        <div class="dc-inroom-snap-col">
          <div class="dc-inroom-section-label">Casting</div>
          ${snapBtn('casting', 'ensemble', 'Ensemble')}
          ${snapBtn('casting', 'featured', 'Featured')}
          ${snapBtn('casting', 'watch', 'Watch')}
          ${snapBtn('casting', 'support', 'Support')}
        </div>
      </div>
      <hr class="dc-inroom-divider" />
      <div class="dc-inroom-notes-col">
        <div class="dc-inroom-section-label">Notes</div>
        ${nextButtonHtml}
        <textarea class="inroom-notes-text" id="inroom-notes" placeholder="note…" oninput="scheduleDcNotesSave('${safeAppId}')">${esc(notesValue || '')}</textarea>
        <div class="inroom-save-hint">Notes save automatically.</div>
      </div>
    </div>`;
  }

  function renderInRoomPageTemplate(config) {
    const {
      app,
      esc,
      usesGeneralInRoomLayout,
      isGeneralAuditionInRoom,
      containerId,
      trayCards,
      currentSession,
      teamAccessMode,
      roleTypeOptions,
      openFn,
      inRoomFlipOpen,
      cardFrontHtml = '',
      cardBackHtml = '',
      scorePanelHtml = '',
      notesTextHtml = '',
      nextButtonHtml = '',
      callbackCharactersHtml = '',
      roleChipsHtml = ''
    } = config;
    const resolvedNotesTextHtml = notesTextHtml || (() => {
      const safeAppId = esc(app?.id || '');
      const noteValue = typeof applicantInRoomNotes === 'function'
        ? applicantInRoomNotes(app, currentSession?.id)
        : '';
      return `<textarea id="inroom-notes" class="inroom-notes-text" placeholder="Write down what you noticed in the room..." oninput="scheduleInRoomNotesSave('${safeAppId}')">${esc(noteValue || '')}</textarea>
          <div class="inroom-save-hint">Notes save automatically.</div>`;
    })();
    const characterListHtml = renderTemplate({ area: 'auditions', component: 'character-list' }, {
      esc,
      roleTypeOptions,
      roleChipsHtml
    });

    const trayHtml = usesGeneralInRoomLayout && containerId === 'aud-session-inroom-content'
      ? ''
      : renderCheckedInStripTemplate({ esc, label: 'Checked In', trayCards });

    const generalOpen = isGeneralAuditionInRoom
      ? `<div class="inroom-primary-container">
          <h2 class="inroom-primary-title">${esc(currentSession?.name || 'General Auditions')}</h2>`
      : '';
    const generalClose = isGeneralAuditionInRoom ? '</div>' : '';

    if (currentSession?.type === 'callback') {
      return `
        ${trayHtml}
        <div class="inroom-main inroom-main-callback">
          <div class="inroom-callback-top-section">
            <div class="inroom-callback-left">
              <div class="inroom-card-stage inroom-callback-card-stage">
                ${renderCastingCardFlipShellTemplate({
                  shellClass: 'inroom-flip',
                  id: 'inroom-flip-card',
                  flipped: inRoomFlipOpen,
                  frontHtml: cardFrontHtml,
                  backHtml: cardBackHtml,
                  frontClick: 'toggleInRoomFlip()',
                  backClick: buildCastingCardBackClickHandler('toggleInRoomFlip')
                })}
              </div>
            </div>
            <div class="inroom-callback-right">
              <div class="inroom-callback-heading">CHARACTERS</div>
              <div class="inroom-callback-character-grid">${callbackCharactersHtml || scorePanelHtml}</div>
            </div>
          </div>
          <div class="inroom-callback-notes-section">
            <div class="inroom-notes-title">NOTES</div>
            ${nextButtonHtml}
            ${resolvedNotesTextHtml}
          </div>
        </div>`;
    }

    return `
        ${trayHtml}
        <div class="inroom-main${usesGeneralInRoomLayout ? ' inroom-main-flat' : ''}">
        ${generalOpen}
        <div class="inroom-card-stage">
          ${renderCastingCardFlipShellTemplate({
            shellClass: 'inroom-flip',
            id: 'inroom-flip-card',
            flipped: inRoomFlipOpen,
            frontHtml: cardFrontHtml,
            backHtml: cardBackHtml,
            frontClick: 'toggleInRoomFlip()',
            backClick: buildCastingCardBackClickHandler('toggleInRoomFlip')
          })}
        </div>
        <div class="inroom-right">${scorePanelHtml}</div>
        <div class="inroom-notes-card">
          <div class="inroom-notes-title">Quick Notes</div>
          ${nextButtonHtml}
          ${resolvedNotesTextHtml}
        </div>
        ${generalClose}
        ${characterListHtml}
        </div>`;
  }

  const api = Object.assign({}, window.BTSAuditionTemplates, {
    registerTemplate,
    findTemplate,
    renderTemplate,
    renderTemplateById,
    buildCastingCardBackClickHandler,
    renderCastingCardFlipShellTemplate,
    renderCharacterListTemplate,
    renderCheckedInStripTemplate,
    renderRoomReadyRequestTemplate,
    renderPortalLoginTemplate,
    renderPortalSessionFrameTemplate,
    renderEmptyStateTemplate,
    renderCastingBoardStickyNoteTemplate,
    renderCastingCardFlipShellTemplate,
    renderInRoomPageTemplate,
    renderDanceCallInRoomTemplate
  });

  window.BTSAuditionTemplates = api;

  api.registerTemplate({
    id: 'auditions.portal.login',
    name: 'Audition Portal Login',
    tags: { area: 'auditions', portal: 'team', component: 'login' },
    priority: 100,
    render: renderPortalLoginTemplate
  });

  api.registerTemplate({
    id: 'auditions.portal.session-frame',
    name: 'Audition Portal Session Frame',
    tags: { area: 'auditions', portal: 'team', component: 'session-frame' },
    priority: 95,
    render: renderPortalSessionFrameTemplate
  });

  api.registerTemplate({
    id: 'auditions.empty-state',
    name: 'Audition Empty State',
    tags: { area: 'auditions', component: 'empty-state' },
    priority: 85,
    render: renderEmptyStateTemplate
  });

  api.registerTemplate({
    id: 'auditions.sticky-note',
    name: 'Audition Sticky Note',
    tags: { area: 'auditions', component: 'sticky-note' },
    priority: 85,
    render: renderStickyNoteTemplate
  });

  api.registerTemplate({
    id: 'auditions.casting-board.sticky-note',
    name: 'Casting Board Sticky Note',
    tags: { area: 'auditions', page: 'casting-board', component: 'sticky-note' },
    priority: 85,
    render: renderCastingBoardStickyNoteTemplate
  });

  api.registerTemplate({
    id: 'auditions.character-list.hint',
    name: 'Character List Hint',
    tags: { area: 'auditions', component: 'character-list-hint' },
    priority: 81,
    render: renderCharacterListHintTemplate
  });

  api.registerTemplate({
    id: 'auditions.character-list',
    name: 'Character List',
    tags: { area: 'auditions', component: 'character-list' },
    priority: 80,
    render: renderCharacterListTemplate
  });

  api.registerTemplate({
    id: 'auditions.in-room.checked-in-strip',
    name: 'In The Room Checked-In Strip - Locked Workspace/Portal Template',
    tags: { area: 'auditions', page: 'in-room', component: 'checked-in-strip' },
    priority: 90,
    render: renderCheckedInStripTemplate
  });

  api.registerTemplate({
    id: 'auditions.in-room.room-ready-request',
    name: 'In The Room Room-Ready Request',
    tags: { area: 'auditions', page: 'in-room', component: 'room-ready-request' },
    priority: 88,
    render: renderRoomReadyRequestTemplate
  });

  api.registerTemplate({
    id: LOCKED_GENERAL_IN_ROOM_TEMPLATE_ID,
    name: 'General Auditions In The Room - Locked Workspace/Portal Source Template',
    tags: { area: 'auditions', page: 'in-room', sessionType: 'general' },
    priority: 100,
    render: renderInRoomPageTemplate
  });

  api.registerTemplate({
    id: 'auditions.in-room.callback',
    name: 'Callback In The Room',
    tags: { area: 'auditions', page: 'in-room', sessionType: 'callback' },
    priority: 90,
    render: renderInRoomPageTemplate
  });

  api.registerTemplate({
    id: 'auditions.in-room.default',
    name: 'Default In The Room',
    tags: { area: 'auditions', page: 'in-room' },
    priority: 10,
    render: renderInRoomPageTemplate
  });

  api.registerTemplate({
    id: 'auditions.in-room.dance-call',
    name: 'Dance Call In The Room',
    tags: { area: 'auditions', page: 'in-room', sessionType: 'dance_call' },
    priority: 95,
    render: renderDanceCallInRoomTemplate
  });
})();
