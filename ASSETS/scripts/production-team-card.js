/**
 * Production Team Card component
 * Casting-card-style card for organiser/team access displays.
 */

const VOLUNTEER_ROLE_IDENTIFIER_MAX_LINE_CHARS = 20;

function renderProductionTeamCard(member, options = {}) {
  const escapeHtml = typeof esc === 'function'
    ? esc
    : (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]));

  const m = member || {};
  const id = escapeHtml(m.id || '');
  const name = escapeHtml(m.name || '');
  const color = escapeHtml(m.note_color || '#572e88');
  const isActive = m.is_active !== false;
  const inactiveClass = isActive ? '' : ' is-inactive';
  const showManagement = options.showManagement !== false;
  const isMini = options.variant === 'mini';
  if (isMini) {
    return renderVolunteerCard(m, { variant: 'mini', state: options.state || m.card_state });
  }

  return `
    <div class="production-team-card-wrap production-team-card-wrap--volunteer" style="--pt-card-color:${color};--volunteer-card-color:${color};">
      <div
        class="production-team-card production-team-card--volunteer${inactiveClass}"
        role="button"
        tabindex="0"
        aria-label="Flip ${name || 'production team member'} card"
        onclick="flipProductionTeamCard(this)"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();flipProductionTeamCard(this);}"
      >
        <div class="production-team-card-inner">
          <div class="production-team-card-face production-team-card-volunteer-face">
            ${renderVolunteerCard(m)}
          </div>
          <div class="production-team-card-face production-team-card-volunteer-face production-team-card-volunteer-back-face">
            ${renderVolunteerCardBack(m, { showManagement })}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderVolunteerCard(member, options = {}) {
  const escapeHtml = typeof esc === 'function' ? esc : productionTeamCardEscape;
  const m = member || {};
  const role = String(m.role || 'Volunteer').trim();
  const name = String(m.name || 'OPEN').trim();
  const color = String(m.note_color || m.noteColor || options.color || '#572e88').trim();
  const isMini = options.variant === 'mini';
  const isOpenState = options.state === 'open'
    || m.card_state === 'open'
    || (!String(m.id || '').trim() && ['', 'OPEN', 'OPEN ROLE'].includes(String(m.name || '').trim().toUpperCase()));
  const displayName = isOpenState
    ? 'OPEN ROLE'
    : name;
  const headshot = isOpenState ? '' : String(m.headshot_url || m.headshot || '').trim();
  const imageHtml = headshot
    ? `<img src="${escapeHtml(headshot)}" alt="${escapeHtml(displayName)}" class="volunteer-card-image" loading="lazy" onerror="this.outerHTML='<div class=\\'volunteer-card-image-placeholder\\'>👤</div>'" />`
    : `<div class="volunteer-card-image-placeholder">👤</div>`;

  return `
    <div class="volunteer-card-wrap${isMini ? ' volunteer-card-wrap--mini' : ''}">
      <div class="volunteer-card${isMini ? ' volunteer-card--mini' : ''}" data-volunteer-card-state="${isOpenState ? 'open' : 'filled'}">
        <div class="volunteer-card-image-area">
          ${imageHtml}
        </div>
        <div class="volunteer-card-blank-lower">
          <div class="volunteer-card-identifier-frame">
            ${renderVolunteerRoleIdentifier({ role, name: displayName, note_color: color }, { framed: false, variant: 'card-front' })}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderVolunteerCardBack(member, options = {}) {
  const escapeHtml = typeof esc === 'function' ? esc : productionTeamCardEscape;
  const m = member || {};
  const id = String(m.id || '').trim();
  const role = String(m.role || 'Volunteer').trim();
  const name = String(m.name || 'OPEN').trim();
  const color = String(m.note_color || m.noteColor || options.color || '#572e88').trim();
  const email = String(m.email || '').trim();
  const phone = window.BTSPhone?.format(m.phone || m.phone_number || '') || (m.phone || m.phone_number || '');
  const passcode = String(m.passcode || '').trim();
  const bio = String(m.bio || '').trim();
  const headshot = String(m.headshot_url || m.headshot || '').trim();
  const roleHtml = volunteerRoleIdentifierBreakRole(role);
  const roleLines = roleHtml.split('<br>');
  const longestRoleLine = roleLines.reduce((longest, line) => line.length > longest.length ? line : longest, '');
  const roleSize = volunteerRoleIdentifierTextSize(longestRoleLine, 1.58, 0.78, 13, 'rem');
  const nameSize = volunteerRoleIdentifierTextSize(name, 0.92, 0.56, 14, 'rem');
  const showManagement = options.showManagement !== false;
  const jsId = escapeHtml(JSON.stringify(id));
  const editAction = id ? ` onclick="event.stopPropagation();openProductionTeamMemberEdit(${jsId})"` : ' disabled';
  const inviteAction = id ? ` onclick="event.stopPropagation();emailTeamInvite(${jsId}, this)"` : ' disabled';
  const copyLinkAction = id ? ` onclick="event.stopPropagation();copyTeamPortalLink(${jsId}, this)"` : ' disabled';
  const removeAction = id && showManagement ? ` onclick="event.stopPropagation();removeProductionTeamMember(${jsId}, this)"` : '';
  const downloadAction = headshot
    ? `<a href="${escapeHtml(headshot)}" target="_blank" download onclick="event.stopPropagation();">Download Headshot</a>`
    : '<button type="button" disabled>Download Headshot</button>';

  return `<div class="volunteer-card-wrap" style="--volunteer-card-color:${escapeHtml(color)};">
    <div class="volunteer-card-back">
      <div class="volunteer-card-back-head">
        <div class="volunteer-card-back-identity" title="${escapeHtml(name)}">
          <span class="volunteer-card-back-dot" aria-hidden="true"></span>
          <span class="volunteer-card-back-role" style="font-size:${roleSize};">${roleHtml.split('<br>').map(escapeHtml).join('<br>')}</span>
          <span class="volunteer-card-back-name" style="font-size:${nameSize};">${escapeHtml(name)}</span>
        </div>
        ${showManagement ? `<button class="volunteer-card-back-trash" type="button" title="Remove volunteer" aria-label="Remove ${escapeHtml(name)}"${removeAction}>
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M9 4h6l1 2h4v2H4V6h4l1-2Zm-1 6h2v8H8v-8Zm6 0h2v8h-2v-8Zm-3 0h2v8h-2v-8ZM6 9h12l-1 12H7L6 9Z"></path>
          </svg>
        </button>` : ''}
        <div class="volunteer-card-back-contact">
          <div><span>Phone:</span><strong>${escapeHtml(phone || 'No phone saved')}</strong></div>
          <div><span>Email:</span><strong>${escapeHtml(email || 'No email saved')}</strong></div>
          <div class="volunteer-card-back-passcode"><span>Volunteer Code:</span><strong>${escapeHtml(passcode || 'Not set')}</strong></div>
        </div>
      </div>
      <div class="volunteer-card-back-bio">
        <span>Bio</span>
        <p>${escapeHtml(bio || 'No bio added yet.')}</p>
      </div>
      ${showManagement ? `<div class="volunteer-card-back-actions" aria-label="Volunteer card actions">
        <button type="button"${editAction}>Edit</button>
        <button type="button"${inviteAction}>Email Invite</button>
        <button type="button"${copyLinkAction}>Copy Link</button>
        ${downloadAction}
      </div>` : ''}
    </div>
  </div>`;
}

function renderVolunteerRoleIdentifier(member, options = {}) {
  const escapeHtml = typeof esc === 'function' ? esc : productionTeamCardEscape;
  const m = member || {};
  const roleText = String(m.role || options.role || 'Volunteer').trim();
  const nameText = String(m.name || options.name || 'OPEN').trim();
  const color = escapeHtml(m.note_color || m.noteColor || options.color || '#572e88');
  const framed = options.framed !== false;
  const isCardFront = options.variant === 'card-front';
  const roleHtml = volunteerRoleIdentifierBreakRole(roleText);
  const roleLines = roleHtml.split('<br>');
  const roleLineCount = roleLines.length;
  const longestRoleLine = roleLines.reduce((longest, line) => line.length > longest.length ? line : longest, '');
  const roleSize = isCardFront
    ? volunteerRoleIdentifierTextSize(longestRoleLine, 10.8, 5.2, 13)
    : volunteerRoleIdentifierTextSize(longestRoleLine, 1.62, 0.78, 13, 'rem');
  const nameSize = isCardFront
    ? volunteerRoleIdentifierTextSize(nameText, 18, 7, 14)
    : volunteerRoleIdentifierTextSize(nameText, 2.4, 0.98, 14, 'rem');

  return `<div class="volunteer-role-identifier${framed ? ' is-framed' : ''}${isCardFront ? ' is-card-front' : ''}" data-volunteer-role-identifier style="--volunteer-role-color:${color};--volunteer-role-base-size:${roleSize};--volunteer-name-base-size:${nameSize};--volunteer-role-size:${roleSize};--volunteer-name-size:${nameSize};--volunteer-role-line-height:${roleLineCount > 1 ? '0.9' : '0.95'};">
    <span class="volunteer-role-identifier-dot-box" aria-hidden="true">
      <span class="volunteer-role-identifier-dot"></span>
    </span>
    <span class="volunteer-role-identifier-copy">
      <span class="volunteer-role-identifier-name">${escapeHtml(nameText)}</span>
      <span class="volunteer-role-identifier-role">${roleHtml.split('<br>').map(escapeHtml).join('<br>')}</span>
    </span>
    <span class="volunteer-role-identifier-balance-box" aria-hidden="true"></span>
  </div>`;
}

function volunteerRoleIdentifierTextSize(text, baseSize, minSize, maxChars, unit = 'cqw') {
  const value = String(text || '').trim();
  if (!value) return `${baseSize}${unit}`;
  const ratio = value.length > maxChars ? maxChars / value.length : 1;
  return `${Math.max(minSize, Number((baseSize * ratio).toFixed(3)))}${unit}`;
}

function volunteerRoleIdentifierBreakRole(roleText, maxCharsPerLine = VOLUNTEER_ROLE_IDENTIFIER_MAX_LINE_CHARS) {
  const words = String(roleText || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Volunteer';
  const lines = [];
  let line = '';
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharsPerLine) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.join('<br>');
}

function volunteerRoleIdentifierParseSize(size) {
  const match = String(size || '').trim().match(/^(-?\d*\.?\d+)([a-z%]+)$/i);
  if (!match) return null;
  return {
    value: Number(match[1]),
    unit: match[2]
  };
}

function volunteerRoleIdentifierScaleSize(size, scale) {
  const parsed = volunteerRoleIdentifierParseSize(size);
  if (!parsed || !Number.isFinite(parsed.value)) return size;
  return `${Number((parsed.value * scale).toFixed(4))}${parsed.unit}`;
}

function volunteerRoleIdentifierMeasureFits(identifier) {
  const copy = identifier?.querySelector?.('.volunteer-role-identifier-copy');
  const role = identifier?.querySelector?.('.volunteer-role-identifier-role');
  const name = identifier?.querySelector?.('.volunteer-role-identifier-name');
  if (!identifier || !copy || !role || !name) return true;

  const copyRect = copy.getBoundingClientRect();
  if (copyRect.width <= 0) return true;

  const tolerance = 1;
  const widthFits = role.scrollWidth <= copy.clientWidth + tolerance
    && name.scrollWidth <= copy.clientWidth + tolerance;
  const heightLimit = copy.clientHeight || identifier.clientHeight;
  const heightFits = !heightLimit || copy.scrollHeight <= heightLimit + tolerance;
  const identifierHeightFits = !identifier.clientHeight || identifier.scrollHeight <= identifier.clientHeight + tolerance;
  return widthFits && heightFits && identifierHeightFits;
}

function volunteerRoleIdentifierStackFits(identifier, copy) {
  const tolerance = 1;
  const heightLimit = copy.clientHeight || identifier.clientHeight;
  const heightFits = !heightLimit || copy.scrollHeight <= heightLimit + tolerance;
  const identifierHeightFits = !identifier.clientHeight || identifier.scrollHeight <= identifier.clientHeight + tolerance;
  return heightFits && identifierHeightFits;
}

function volunteerRoleIdentifierTextFits(textElement, copy) {
  return textElement.scrollWidth <= copy.clientWidth + 1;
}

function volunteerRoleIdentifierFindScale({ minScale, maxScale, testScale }) {
  let low = minScale;
  let high = maxScale;
  let best = minScale;

  if (testScale(high)) return high;

  for (let i = 0; i < 14; i += 1) {
    const mid = (low + high) / 2;
    if (testScale(mid)) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  return best;
}

function fitVolunteerRoleIdentifier(identifier) {
  if (!identifier?.isConnected) return;

  const copy = identifier.querySelector?.('.volunteer-role-identifier-copy');
  const role = identifier.querySelector?.('.volunteer-role-identifier-role');
  const name = identifier.querySelector?.('.volunteer-role-identifier-name');
  if (!copy || !role || copy.getBoundingClientRect().width <= 0) return;

  const baseRoleSize = identifier.style.getPropertyValue('--volunteer-role-base-size')
    || identifier.style.getPropertyValue('--volunteer-role-size');
  const baseNameSize = identifier.style.getPropertyValue('--volunteer-name-base-size')
    || identifier.style.getPropertyValue('--volunteer-name-size');
  if (!volunteerRoleIdentifierParseSize(baseRoleSize)) return;
  const hasName = Boolean(name && name.textContent.trim());
  if (hasName && !volunteerRoleIdentifierParseSize(baseNameSize)) return;

  const maxScale = identifier.classList.contains('is-card-front') ? 1.14 : 1;
  const minScale = 0.05;

  // Template rule: role and name fit independently.
  // Role wraps at 20 characters per line; name stays one line and only shrinks to fit its own width or the total stack height.
  const applyScales = (roleScale, nameScale) => {
    identifier.style.setProperty('--volunteer-role-size', volunteerRoleIdentifierScaleSize(baseRoleSize, roleScale));
    if (hasName) {
      identifier.style.setProperty('--volunteer-name-size', volunteerRoleIdentifierScaleSize(baseNameSize, nameScale));
    }
  };

  let roleScale = volunteerRoleIdentifierFindScale({
    minScale,
    maxScale,
    testScale: (scale) => {
      applyScales(scale, maxScale);
      return volunteerRoleIdentifierTextFits(role, copy);
    }
  });

  let nameScale = maxScale;
  if (hasName) {
    nameScale = volunteerRoleIdentifierFindScale({
      minScale,
      maxScale,
      testScale: (scale) => {
        applyScales(roleScale, scale);
        return volunteerRoleIdentifierTextFits(name, copy);
      }
    });
  }

  applyScales(roleScale, nameScale);
  if (!volunteerRoleIdentifierStackFits(identifier, copy)) {
    roleScale = volunteerRoleIdentifierFindScale({
      minScale,
      maxScale: roleScale,
      testScale: (scale) => {
        applyScales(scale, nameScale);
        return volunteerRoleIdentifierTextFits(role, copy) && volunteerRoleIdentifierStackFits(identifier, copy);
      }
    });
    applyScales(roleScale, nameScale);
  }

  if (hasName && !volunteerRoleIdentifierStackFits(identifier, copy)) {
    nameScale = volunteerRoleIdentifierFindScale({
      minScale,
      maxScale: nameScale,
      testScale: (scale) => {
        applyScales(roleScale, scale);
        return volunteerRoleIdentifierTextFits(name, copy) && volunteerRoleIdentifierStackFits(identifier, copy);
      }
    });
  }

  applyScales(roleScale, nameScale);
}

let volunteerRoleIdentifierFitQueued = false;

function fitVolunteerRoleIdentifiers(root = document) {
  const scope = root?.querySelectorAll ? root : document;
  const identifiers = scope.matches?.('.volunteer-role-identifier')
    ? [scope]
    : Array.from(scope.querySelectorAll?.('.volunteer-role-identifier') || []);
  identifiers.forEach(fitVolunteerRoleIdentifier);
}

function scheduleVolunteerRoleIdentifierFit(root = document) {
  if (typeof window === 'undefined') return;
  if (volunteerRoleIdentifierFitQueued) return;
  volunteerRoleIdentifierFitQueued = true;
  window.requestAnimationFrame(() => {
    volunteerRoleIdentifierFitQueued = false;
    fitVolunteerRoleIdentifiers(root);
  });
}

function initVolunteerRoleIdentifierAutoFit() {
  if (typeof window === 'undefined' || window.__btsVolunteerRoleIdentifierAutoFit) return;
  window.__btsVolunteerRoleIdentifierAutoFit = true;

  const onReady = () => scheduleVolunteerRoleIdentifierFit(document);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }
  window.addEventListener('load', onReady, { once: true });
  window.addEventListener('resize', () => scheduleVolunteerRoleIdentifierFit(document), { passive: true });

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver((mutations) => {
      if (mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node => (
        node.nodeType === 1
        && (node.matches?.('.volunteer-role-identifier') || node.querySelector?.('.volunteer-role-identifier'))
      )))) {
        scheduleVolunteerRoleIdentifierFit(document);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

function renderCreativeTeamLayoutTemplate(member, options = {}) {
  const escapeHtml = typeof esc === 'function' ? esc : productionTeamCardEscape;
  const m = member || {};
  const role = escapeHtml(m.role || options.role || 'Director');
  const name = escapeHtml(m.name || options.name || 'Firstname Lastname');
  const color = escapeHtml(m.note_color || m.noteColor || options.color || '#572e88');
  const halo = escapeHtml(options.halo || '#e7ddf3');
  const roleSize = escapeHtml(options.roleSize || 'clamp(1.75rem, 3.5vw, 2.8rem)');
  const nameSize = escapeHtml(options.nameSize || 'clamp(1.15rem, 2vw, 1.85rem)');
  const width = escapeHtml(options.width || 'min(100%, 420px)');
  const minHeight = escapeHtml(options.minHeight || '150px');
  const dotColumn = escapeHtml(options.dotColumn || '3.2rem');
  const dotSize = escapeHtml(options.dotSize || '1.55rem');
  const dotHalo = escapeHtml(options.dotHalo || '0.42rem');
  const framed = options.framed !== false;
  const innerHtml = `
    <div style="display:grid;grid-template-columns:${dotColumn} minmax(0,1fr);align-items:center;column-gap:0.65rem;min-width:0;">
      <span aria-hidden="true" style="width:${dotSize};height:${dotSize};border-radius:999px;background:${color};box-shadow:0 0 0 ${dotHalo} ${halo};justify-self:center;align-self:center;grid-row:1 / span 2;"></span>
      <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;color:#111;font-size:${roleSize};font-weight:950;line-height:0.95;text-transform:uppercase;">${role}</div>
      <div style="grid-column:2;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#242124;font-size:${nameSize};font-weight:500;line-height:1.12;text-transform:uppercase;margin-top:0.22rem;">${name}</div>
    </div>`;

  if (!framed) {
    return `<div data-bts-template="creative-team-layout" style="width:${width};min-height:${minHeight};display:grid;align-content:center;color:#111;">${innerHtml}</div>`;
  }

  return `
    <div data-bts-template="creative-team-layout" style="width:${width};min-height:${minHeight};margin:0 auto;padding:1.2rem 1.35rem;border-radius:12px;border:1.5px solid #e4deed;background:#fff;color:#111;display:grid;align-content:center;">
      ${innerHtml}
    </div>`;
}

function getProductionTeamCardTextSize(text, baseSize, minSize, maxChars) {
  const value = String(text || '').trim();
  if (!value) return `${baseSize}cqw`;
  const ratio = value.length > maxChars ? (maxChars / value.length) : 1;
  const fitted = Math.max(minSize, Number((baseSize * ratio).toFixed(3)));
  return `${fitted}cqw`;
}

window.BTSProductionTeamTemplates = Object.assign({}, window.BTSProductionTeamTemplates, {
  renderProductionTeamCard,
  renderVolunteerCard,
  renderVolunteerCardBack,
  renderVolunteerRoleIdentifier,
  fitVolunteerRoleIdentifiers,
  renderCreativeTeamLayoutTemplate
});

initVolunteerRoleIdentifierAutoFit();

function productionTeamCardEscape(value) {
  if (typeof esc === 'function') return esc(value);
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getProductionTeamCardMember(memberId) {
  let members = [];
  try {
    members = Array.isArray(auditionTeamMembers) ? auditionTeamMembers : [];
  } catch (error) {
    members = Array.isArray(window.auditionTeamMembers) ? window.auditionTeamMembers : [];
  }
  return members.find(member => String(member.id) === String(memberId)) || null;
}

function flipProductionTeamCard(card) {
  card?.classList.toggle('is-flipped');
}

function ptcBtnFeedback(btn, { working = null, done = 'Saved', timeout = 1800, restore = true } = {}) {
  if (!btn) return () => {};
  const label = btn.querySelector?.('.production-team-card-action-label');
  const status = btn.querySelector?.('.production-team-card-action-status');
  const orig = label ? label.textContent.trim() : btn.textContent.trim();
  btn.classList.remove('did-work', 'is-clicked');
  void btn.offsetWidth;
  btn.classList.add('is-clicked');
  setTimeout(() => btn.classList.remove('is-clicked'), 420);
  btn.classList.add('is-working');
  btn.disabled = true;
  if (working) {
    if (status) status.textContent = working;
    else btn.textContent = working;
  }
  return function ptcMarkDone(success = true) {
    btn.classList.remove('is-working');
    btn.disabled = false;
    if (success) {
      if (status) status.textContent = done;
      else btn.textContent = done;
      btn.classList.add('did-work');
      if (restore) {
        setTimeout(() => {
          if (status) status.textContent = '';
          else btn.textContent = orig;
          btn.classList.remove('did-work');
        }, timeout);
      }
    } else {
      if (status) status.textContent = '';
      else btn.textContent = orig;
    }
  };
}

async function copyProductionTeamCardPasscode(memberId, btn) {
  const member = getProductionTeamCardMember(memberId);
  if (!member?.passcode) return;
  const markDone = ptcBtnFeedback(btn, { done: 'Copied' });
  try {
    await navigator.clipboard.writeText(member.passcode);
    markDone(true);
    showToast?.('Passcode copied.');
  } catch (error) {
    console.error('Copy passcode failed', error);
    markDone(false);
    showToast?.('Could not copy passcode.', 'error');
  }
}
