(function () {
  const templateRegistry = [];

  function fallbackEsc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

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

  function findTemplate(query = {}) {
    const queryTags = normalizeTags(query);
    let best = null;
    let bestScore = -1;
    for (const template of templateRegistry) {
      let score = template.priority || 0;
      for (const [key, value] of Object.entries(template.tags || {})) {
        if (queryTags[key] !== value) {
          score = -1;
          break;
        }
        score += 10;
      }
      if (score > bestScore) {
        best = template;
        bestScore = score;
      }
    }
    return best;
  }

  function renderTemplate(query = {}, config = {}) {
    const template = findTemplate(query);
    return template ? template.render(config) : '';
  }

  function renderTemplateById(id, config = {}) {
    const template = templateRegistry.find(item => item.id === id);
    return template ? template.render(config) : '';
  }

  function escFor(config) {
    return typeof config?.esc === 'function' ? config.esc : fallbackEsc;
  }

  function renderResponseStatusTemplate(config = {}) {
    const esc = escFor(config);
    const {
      title = '',
      note = '',
      state = 'accepted',
      id = '',
      titleId = '',
      noteId = '',
      hidden = false,
      extraClass = ''
    } = config;
    const isDeclined = state === 'declined';
    return `<div class="response-submitted${isDeclined ? ' declined' : ''}${hidden ? ' hidden' : ''}${extraClass ? ` ${esc(extraClass)}` : ''}"${id ? ` id="${esc(id)}"` : ''}>
      <div class="response-submitted-title"${titleId ? ` id="${esc(titleId)}"` : ''}>${esc(title)}</div>
      <div class="response-submitted-note"${noteId ? ` id="${esc(noteId)}"` : ''}>${esc(note)}</div>
    </div>`;
  }

  function renderCreativeTeamLockupTemplate(config = {}) {
    const esc = escFor(config);
    const { role = '', name = '', dotColor = '#572e88', haloColor = '#e7ddf3' } = config;
    return `<div class="creative-team-member">
      <span class="creative-team-dot" style="--creative-dot:${esc(dotColor)};--creative-dot-halo:${esc(haloColor)};" aria-hidden="true"></span>
      <div class="creative-team-copy">
        <div class="creative-team-role">${esc(role)}</div>
        <div class="creative-team-name">${esc(name)}</div>
      </div>
    </div>`;
  }

  function renderCreativeTeamListTemplate(config = {}) {
    const esc = escFor(config);
    const { entries = [], emptyLabel = 'TBC' } = config;
    if (!entries.length) return `<div class="info-card-value">${esc(emptyLabel)}</div>`;
    return `<div class="creative-team-list">${entries.map(item => renderCreativeTeamLockupTemplate({
      esc,
      role: item.role,
      name: item.name,
      dotColor: item.dotColor || '#572e88',
      haloColor: item.haloColor || '#e7ddf3'
    })).join('')}</div>`;
  }

  function renderInfoCardTemplate(config = {}) {
    const esc = escFor(config);
    const {
      icon = '',
      iconHtml = '',
      label = '',
      value = '',
      valueHtml = '',
      meta = '',
      details = [],
      className = '',
      iconClass = ''
    } = config;
    const resolvedIconHtml = iconHtml || (icon ? `<img src="${esc(icon)}" alt="" />` : '');
    const resolvedValueHtml = valueHtml || `<div class="info-card-value">${esc(value)}</div>`;
    return `<div class="info-card${className ? ` ${esc(className)}` : ''}">
      <div class="info-card-icon${iconClass ? ` ${esc(iconClass)}` : ''}">${resolvedIconHtml}</div>
      <div class="info-card-body">
        ${label ? `<div class="info-card-label">${esc(label)}</div>` : ''}
        ${resolvedValueHtml}
        ${meta ? `<div class="info-card-meta">${esc(meta)}</div>` : ''}
        ${(details || []).filter(Boolean).map(detail => `<div class="info-card-detail">${esc(detail)}</div>`).join('')}
      </div>
    </div>`;
  }

  function renderDeadlineBannerTemplate(config = {}) {
    const esc = escFor(config);
    const { id = '', text = '', hidden = false } = config;
    return `<div class="deadline-bar${hidden ? ' hidden' : ''}"${id ? ` id="${esc(id)}"` : ''}>
      <span class="deadline-dot"></span>
      <span${id ? ` id="${esc(id)}-text"` : ''}>${esc(text)}</span>
    </div>`;
  }

  function renderScheduleEventTemplate(config = {}) {
    const esc = escFor(config);
    const {
      id = '',
      type = '',
      dateLabel = 'Date TBC',
      timeLabel = 'Time TBC',
      typeLabel = '',
      showType = false,
      unavailable = false,
      locked = false
    } = config;
    return `<button class="event${unavailable ? ' unavailable' : ''}" type="button" data-event-id="${esc(id)}" data-type="${esc(type)}" aria-pressed="${unavailable ? 'true' : 'false'}" aria-disabled="${locked ? 'true' : 'false'}"${locked ? ' disabled' : ''}>
      <div class="event-info">
        <div class="event-name">${esc(dateLabel)}</div>
        ${showType && typeLabel ? `<div class="event-kind">${esc(typeLabel)}</div>` : ''}
        <div class="event-meta">${esc(timeLabel)}</div>
      </div>
    </button>`;
  }

  function renderScheduleGroupTemplate(config = {}) {
    const esc = escFor(config);
    const { title = '', countLabel = '', eventsHtml = '' } = config;
    return `<div class="schedule-group">
      <div class="schedule-group-header">
        <span class="schedule-title">${esc(title)}</span>
        ${countLabel ? `<span class="sched-count">${esc(countLabel)}</span>` : ''}
      </div>
      <div class="event-list">${eventsHtml}</div>
    </div>`;
  }

  function renderConflictItemTemplate(config = {}) {
    const esc = escFor(config);
    const {
      id = '',
      source = '',
      eventId = '',
      title = '',
      detail = '',
      resolved = false,
      locked = false
    } = config;
    return `<button class="conflict${resolved ? ' resolved' : ''}" type="button" data-conflict-id="${esc(id)}" data-source="${esc(source)}" data-event-id="${esc(eventId)}" aria-pressed="${resolved ? 'true' : 'false'}" aria-disabled="${locked ? 'true' : 'false'}"${locked ? ' disabled' : ''}>
      <div class="conflict-inner">
        <div class="conflict-check"></div>
        <div>
          <div class="conflict-title">${esc(title)}</div>
          ${detail ? `<div class="conflict-detail">${esc(detail)}</div>` : ''}
        </div>
      </div>
      <span class="conflict-resolved-label">Resolved</span>
    </button>`;
  }

  function renderCardShellTemplate(config = {}) {
    const esc = escFor(config);
    const {
      icon = '',
      label = '',
      title = '',
      bodyId = '',
      bodyHtml = ''
    } = config;
    return `<div class="bts-card">
      <div class="card-head">
        <div class="card-head-icon">
          ${icon ? `<img src="${esc(icon)}" alt="" />` : ''}
        </div>
        <div class="card-head-text">
          <div class="card-label">${esc(label)}</div>
          <div class="card-title">${esc(title)}</div>
        </div>
      </div>
      <div class="card-body"${bodyId ? ` id="${esc(bodyId)}"` : ''}>${bodyHtml}</div>
    </div>`;
  }

  const api = Object.assign({}, window.BTSCastOfferTemplates, {
    registerTemplate,
    findTemplate,
    renderTemplate,
    renderTemplateById,
    renderResponseStatusTemplate,
    renderCreativeTeamLockupTemplate,
    renderCreativeTeamListTemplate,
    renderInfoCardTemplate,
    renderDeadlineBannerTemplate,
    renderScheduleEventTemplate,
    renderScheduleGroupTemplate,
    renderConflictItemTemplate,
    renderCardShellTemplate
  });

  window.BTSCastOfferTemplates = api;

  [
    ['cast-offer.response-status', 'Response Status', { component: 'response-status' }, renderResponseStatusTemplate],
    ['cast-offer.creative-team-lockup', 'Creative Team Lockup', { component: 'creative-team-lockup' }, renderCreativeTeamLockupTemplate],
    ['cast-offer.creative-team-list', 'Creative Team List', { component: 'creative-team-list' }, renderCreativeTeamListTemplate],
    ['cast-offer.info-card', 'Info Card', { component: 'info-card' }, renderInfoCardTemplate],
    ['cast-offer.deadline-banner', 'Deadline Banner', { component: 'deadline-banner' }, renderDeadlineBannerTemplate],
    ['cast-offer.schedule-event', 'Schedule Event', { component: 'schedule-event' }, renderScheduleEventTemplate],
    ['cast-offer.schedule-group', 'Schedule Group', { component: 'schedule-group' }, renderScheduleGroupTemplate],
    ['cast-offer.conflict-item', 'Conflict Item', { component: 'conflict-item' }, renderConflictItemTemplate],
    ['cast-offer.card-shell', 'Card Shell', { component: 'card-shell' }, renderCardShellTemplate]
  ].forEach(([id, name, tags, render]) => registerTemplate({
    id,
    name,
    tags: { area: 'cast-offer', ...tags },
    priority: 100,
    render
  }));
})();
