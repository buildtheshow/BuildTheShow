(function () {
  const templateRegistry = [];

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

  function renderRoleTypeOptions(roleTypeOptions, esc) {
    return roleTypeOptions.map(rt => `<option value="${esc(rt)}">${esc(rt)}</option>`).join('');
  }

  function renderCharacterListTemplate(config) {
    const {
      esc,
      roleTypeOptions = [],
      roleChipsHtml = ''
    } = config;

    return `<div class="inroom-roles-card inroom-bottom-roles">
          <div class="inroom-roles-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.6rem;">
            <div class="inroom-roles-title" style="margin:0;">Character List</div>
            <div class="inroom-roles-controls" style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">
              <select id="inroom-role-filter" onchange="filterInRoomRoleChips()" style="font-size:0.78rem;font-family: var(--bts-font);border:1.5px solid rgba(87,46,136,0.2);border-radius:8px;padding:0.25rem 0.5rem;color:#4a3d6b;background:#fff;cursor:pointer;">
                <option value="">All roles</option>
                ${renderRoleTypeOptions(roleTypeOptions, esc)}
              </select>
              <select id="inroom-role-sort" onchange="filterInRoomRoleChips()" style="font-size:0.78rem;font-family: var(--bts-font);border:1.5px solid rgba(87,46,136,0.2);border-radius:8px;padding:0.25rem 0.5rem;color:#4a3d6b;background:#fff;cursor:pointer;">
                <option value="type">By role type</option>
                <option value="az">A - Z</option>
                <option value="za">Z - A</option>
              </select>
            </div>
          </div>
          <div class="inroom-roles-grid" id="inroom-roles-grid">${roleChipsHtml}</div>
          <div class="inroom-save-hint">Gold means they asked for it. Purple means we like them for it.</div>
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
      cbCastClick,
      isDanceCall,
      listLabel
    } = config;

    return `
      <div class="aud-session-topnav" style="--session-accent:${esc(headerAccent)};">
        <div class="aud-day-topnav">
          ${teamAccessMode ? '' : `<button type="button" class="aud-day-topnav-btn${activeTool === 'checkin' ? ' active' : ''}" onclick="${ciClick}">Check In</button>`}
          <button type="button" class="aud-day-topnav-btn${activeTool === 'inroom' ? ' active' : ''}" onclick="${irClick}">In the Room</button>
          ${teamAccessMode || isDanceCall ? '' : `
          <button type="button" class="aud-day-topnav-btn${activeTool === 'castingboard' ? ' active' : ''}" onclick="${cbCastClick}">Casting Board</button>
          <button type="button" class="aud-day-topnav-btn${activeTool === 'callbacks' ? ' active' : ''}" onclick="openAuditionsSubTab('callbacks')">${esc(listLabel)}</button>
          `}
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
      cardFrontHtml,
      cardBackHtml,
      scorePanelHtml,
      notesTextHtml,
      teamNoteHtml,
      roleChipsHtml
    } = config;
    const characterListHtml = renderTemplate({ area: 'auditions', component: 'character-list' }, {
      esc,
      roleTypeOptions,
      roleChipsHtml
    });

    const trayHtml = usesGeneralInRoomLayout && containerId === 'aud-session-inroom-content'
      ? ''
      : `<div class="inroom-tray${usesGeneralInRoomLayout ? ' inroom-tray-flat' : ''}">
          <div class="inroom-thumbs">${trayCards}</div>
        </div>`;

    const generalOpen = isGeneralAuditionInRoom
      ? `<div class="inroom-primary-container">
          <h2 class="inroom-primary-title">${esc(currentSession?.name || 'General Auditions')}</h2>`
      : '';
    const generalClose = isGeneralAuditionInRoom ? '</div>' : '';

    return `
        ${trayHtml}
        <div class="inroom-main${usesGeneralInRoomLayout ? ' inroom-main-flat' : ''}">
        ${generalOpen}
        <div class="inroom-card-stage">
          <div class="inroom-flip${inRoomFlipOpen ? ' flipped' : ''}" id="inroom-flip-card" onclick="toggleInRoomFlip()">
            <div class="inroom-flip-inner">
              <div class="inroom-face front">
                <div class="inroom-front-card-wrap">${cardFrontHtml}</div>
              </div>
              <div class="inroom-face back">
                ${cardBackHtml}
              </div>
            </div>
          </div>
        </div>
        <div class="inroom-right">${scorePanelHtml}</div>
        <div class="inroom-notes-card">
          <div class="inroom-notes-title">Quick Notes</div>
          ${teamAccessMode ? '' : notesTextHtml}
          ${isGeneralAuditionInRoom ? '' : teamNoteHtml}
        </div>
        ${generalClose}
        ${characterListHtml}
        </div>`;
  }

  const api = Object.assign({}, window.BTSAuditionTemplates, {
    registerTemplate,
    findTemplate,
    renderTemplate,
    renderCharacterListTemplate,
    renderPortalLoginTemplate,
    renderPortalSessionFrameTemplate,
    renderEmptyStateTemplate,
    renderInRoomPageTemplate
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
    id: 'auditions.character-list',
    name: 'Character List',
    tags: { area: 'auditions', component: 'character-list' },
    priority: 80,
    render: renderCharacterListTemplate
  });

  api.registerTemplate({
    id: 'auditions.in-room.general',
    name: 'General Auditions In The Room',
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
})();
