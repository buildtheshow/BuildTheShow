/**
 * Production Team Card component
 * Casting-card-style card for organiser/team access displays.
 */

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
  const firstName = escapeHtml((m.name || '').trim().split(/\s+/)[0] || 'Firstname');
  const role = escapeHtml(m.role || '');
  const email = escapeHtml(m.email || '');
  const phoneValue = window.BTSPhone?.format(m.phone || m.phone_number || '') || (m.phone || m.phone_number || '');
  const phone = escapeHtml(phoneValue);
  const passcode = escapeHtml(m.passcode || '');
  const color = escapeHtml(m.note_color || '#572e88');
  const initial = escapeHtml((m.name || '?').trim().charAt(0).toUpperCase() || '?');
  const isActive = m.is_active !== false;
  const inactiveClass = isActive ? '' : ' is-inactive';
  const statusClass = isActive ? 'is-active' : 'is-inactive';
  const roleSize = getProductionTeamCardTextSize(m.role || 'Production Team', 10.6, 5.2, 8);
  const nameSize = getProductionTeamCardTextSize(m.name || 'Firstname Lastname', 5.8, 3.1, 14);
  const backRoleSize = getProductionTeamCardTextSize(m.role || 'Production Team', 5.3, 2.6, 8);
  const backNameSize = getProductionTeamCardTextSize(m.name || 'Firstname Lastname', 2.9, 1.55, 14);
  const sentDate = m.invite_sent_at
    ? new Date(m.invite_sent_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : '';
  const showManagement = options.showManagement !== false;
  const variantClass = options.variant === 'mini' ? ' production-team-card-wrap--mini' : '';
  const cardClass = options.variant === 'mini' ? ' production-team-card--mini' : '';
  const photoHtml = m.headshot_url
    ? `<img src="${escapeHtml(m.headshot_url)}" alt="" class="production-team-card-image" />`
    : `<div class="production-team-card-placeholder">${initial}</div>`;

  const inviteLabel = m.invite_sent_at
    ? '<span>Resend</span><span>Invite</span>'
    : '<span>Email</span><span>Invite</span>';
  const inviteHtml = `<button id="invite-btn-${id}" class="production-team-card-back-action" type="button" onclick="event.stopPropagation();emailTeamInvite('${id}', this)"><span class="production-team-card-action-label">${inviteLabel}</span><span class="production-team-card-action-status"></span></button>`;

  const bio = String(m.bio || '');
  const bioText = escapeHtml(bio || 'No bio added yet.');

  return `
    <div class="production-team-card-wrap${variantClass}" style="--pt-card-color:${color};">
      <div
        class="production-team-card${cardClass}${inactiveClass}"
        role="button"
        tabindex="0"
        aria-label="Flip ${name || 'production team member'} card"
        onclick="flipProductionTeamCard(this)"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();flipProductionTeamCard(this);}"
      >
        <div class="production-team-card-inner">
          <div class="production-team-card-face production-team-card-front">
            <div class="production-team-card-image-area">
              ${photoHtml}
            </div>
            <div class="production-team-card-lower">
              <div class="production-team-role-lockup production-team-card-front-lockup" title="${name || 'Firstname Lastname'}">
                <span class="production-team-card-colour-chip" title="Team colour" aria-hidden="true"></span>
                <div class="production-team-card-role" title="${role}" style="font-size:${roleSize};">${role || 'Production Team'}</div>
                <div class="production-team-card-name" title="${name}" style="font-size:${nameSize};">${name || 'Firstname Lastname'}</div>
              </div>
            </div>
          </div>
          <div class="production-team-card-face production-team-card-back">
            <div class="production-team-card-back-head">
              <div class="production-team-role-lockup production-team-card-back-identity" title="${name || 'Firstname Lastname'}">
                <span class="production-team-card-back-dot" aria-hidden="true"></span>
                <span class="production-team-card-back-role-inline" style="font-size:${backRoleSize};">${role || 'Production Team'}</span>
                <span class="production-team-card-back-full-name" style="font-size:${backNameSize};">${name || 'Firstname Lastname'}</span>
              </div>
              <div class="production-team-card-back-contact">
                <div class="production-team-card-back-contact-item">
                  <span>Phone:</span>
                  <strong>${phone || 'No phone saved'}</strong>
                </div>
                <div class="production-team-card-back-contact-item production-team-card-back-contact-email">
                  <span>Email:</span>
                  <input class="production-team-card-back-input" type="email" value="${email}" placeholder="No email saved" onclick="event.stopPropagation();" onblur="saveTeamMemberField('${id}','email',this.value)" />
                </div>
                <div class="production-team-card-back-contact-item production-team-card-back-contact-passcode">
                  <span>Passcode:</span>
                  <div class="production-team-card-back-passcode-row" onclick="event.stopPropagation();">
                    <input id="passcode-input-${id}" class="production-team-card-back-input production-team-card-back-passcode" value="${passcode}" placeholder="6 digits" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" oninput="this.value=this.value.replace(/\\D+/g,'').slice(0,6)" />
                    <button class="production-team-card-back-icon" type="button" onclick="saveTeamMemberPasscode('${id}',this)" title="Save access code">Save</button>
                    <button class="production-team-card-back-icon" type="button" onclick="regenPasscode('${id}',this)" title="Generate new 6-digit passcode">↻</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="production-team-card-back-fields">
              <div class="production-team-card-back-field production-team-card-back-bio">
                <span>Bio</span>
                <p>${bioText}</p>
              </div>
            </div>
            ${showManagement ? `
              <div class="production-team-card-back-actions" onclick="event.stopPropagation();">
                <button class="production-team-card-back-action" type="button" onclick="openProductionTeamMemberEdit('${id}')"><span class="production-team-card-action-label">Edit</span><span class="production-team-card-action-status"></span></button>
                ${inviteHtml}
                <button class="production-team-card-back-action" type="button" onclick="copyTeamPortalLink('${id}',this)"><span class="production-team-card-action-label"><span>Copy</span><span>Link</span></span><span class="production-team-card-action-status"></span></button>
                <button class="production-team-card-back-action" type="button" onclick="copyProductionTeamCardPasscode('${id}',this)"><span class="production-team-card-action-label"><span>Copy</span><span>Passcode</span></span><span class="production-team-card-action-status"></span></button>
                ${m.headshot_url ? `<a class="production-team-card-back-action" href="${escapeHtml(m.headshot_url)}" target="_blank" download onclick="ptcBtnFeedback(this,{working:'Downloading',done:'Downloaded'})?.(true)"><span class="production-team-card-action-label"><span>Download</span><span>Headshot</span></span><span class="production-team-card-action-status"></span></a>` : ''}
              </div>
              <button class="production-team-card-trash" type="button" onclick="event.stopPropagation();removeProductionTeamMember('${id}',this)" title="Remove team member" aria-label="Remove ${name || 'production team member'}">
                <span class="production-team-card-trash-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9 4h6l1 2h4v2H4V6h4l1-2Zm-1 6h2v8H8v-8Zm6 0h2v8h-2v-8Zm-3 0h2v8h-2v-8ZM6 9h12l-1 12H7L6 9Z"></path>
                  </svg>
                </span>
                <span class="production-team-card-action-label">Remove</span>
                <span class="production-team-card-action-status"></span>
              </button>
            ` : ''}
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
  const headshot = String(m.headshot_url || m.headshot || '').trim();
  const isMini = options.variant === 'mini';
  const imageHtml = headshot
    ? `<img src="${escapeHtml(headshot)}" alt="${escapeHtml(name)}" class="volunteer-card-image" loading="lazy" onerror="this.outerHTML='<div class=\\'volunteer-card-image-placeholder\\'>👤</div>'" />`
    : `<div class="volunteer-card-image-placeholder">👤</div>`;

  return `
    <div class="volunteer-card-wrap${isMini ? ' volunteer-card-wrap--mini' : ''}">
      <div class="volunteer-card${isMini ? ' volunteer-card--mini' : ''}">
        <div class="volunteer-card-image-area">
          ${imageHtml}
        </div>
        <div class="volunteer-card-blank-lower" aria-hidden="true"></div>
      </div>
    </div>
  `;
}

function renderVolunteerCardBack(member, options = {}) {
  const escapeHtml = typeof esc === 'function' ? esc : productionTeamCardEscape;
  const m = member || {};
  const color = String(m.note_color || m.noteColor || options.color || '#572e88').trim();
  return `<div class="volunteer-card-wrap" style="--volunteer-card-color:${escapeHtml(color)};">
    <div class="volunteer-card-back" aria-label="Blank volunteer card back"></div>
  </div>`;
}

function renderVolunteerRoleIdentifier(member, options = {}) {
  const escapeHtml = typeof esc === 'function' ? esc : productionTeamCardEscape;
  const m = member || {};
  const role = escapeHtml(m.role || options.role || 'Volunteer');
  const name = escapeHtml(m.name || options.name || 'OPEN');
  const color = escapeHtml(m.note_color || m.noteColor || options.color || '#572e88');
  const framed = options.framed !== false;
  return `<div class="volunteer-role-identifier${framed ? ' is-framed' : ''}" style="--volunteer-role-color:${color};">
    <span class="volunteer-role-identifier-dot" aria-hidden="true"></span>
    <span class="volunteer-role-identifier-role">${role}</span>
    <span class="volunteer-role-identifier-name">${name}</span>
  </div>`;
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
  renderCreativeTeamLayoutTemplate
});

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
