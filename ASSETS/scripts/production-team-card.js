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
  const role = escapeHtml(m.role || '');
  const email = escapeHtml(m.email || '');
  const phone = escapeHtml(m.phone || m.phone_number || '');
  const passcode = escapeHtml(m.passcode || '');
  const color = escapeHtml(m.note_color || '#572e88');
  const initial = escapeHtml((m.name || '?').trim().charAt(0).toUpperCase() || '?');
  const isActive = m.is_active !== false;
  const inactiveClass = isActive ? '' : ' is-inactive';
  const statusClass = isActive ? 'is-active' : 'is-inactive';
  const sentDate = m.invite_sent_at
    ? new Date(m.invite_sent_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : '';
  const showManagement = options.showManagement !== false;
  const photoHtml = m.headshot_url
    ? `<img src="${escapeHtml(m.headshot_url)}" alt="" class="production-team-card-image" />`
    : `<div class="production-team-card-placeholder">${initial}</div>`;

  const inviteHtml = m.invite_sent_at
    ? `<button id="invite-btn-${id}" class="production-team-card-back-action" type="button" onclick="event.stopPropagation();emailTeamInvite('${id}', this)">Resend Invite</button>`
    : `<button id="invite-btn-${id}" class="btn-primary" type="button" onclick="event.stopPropagation();emailTeamInvite('${id}', this)">Email Invite</button>`;

  const bio = String(m.bio || '');
  const bioText = escapeHtml(bio || 'No bio added yet.');

  return `
    <div class="production-team-card-wrap" style="--pt-card-color:${color};">
      <div
        class="production-team-card${inactiveClass}"
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
              <div class="production-team-card-role-line">
                <span class="production-team-card-colour-chip" title="Team colour"></span>
                <div class="production-team-card-role" title="${role}">${role || 'Production Team'}</div>
              </div>
              <div class="production-team-card-name" title="${name}">${name || 'Firstname Lastname'}</div>
            </div>
          </div>
          <div class="production-team-card-face production-team-card-back">
            <div class="production-team-card-back-head">
              <div class="production-team-card-back-role">${role || 'Production Team'}</div>
              <div class="production-team-card-back-name">${name || 'Firstname Lastname'}</div>
            </div>
            <div class="production-team-card-back-fields">
              <label class="production-team-card-back-status ${statusClass}" onclick="event.stopPropagation();">
                <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleTeamMemberAccess('${id}',this.checked)" />
                ${isActive ? 'Active' : 'Inactive'}
              </label>
              <div class="production-team-card-back-field">
                <span>Email</span>
                <input class="production-team-card-back-input" type="email" value="${email}" placeholder="No email saved" onclick="event.stopPropagation();" onblur="saveTeamMemberField('${id}','email',this.value)" />
              </div>
              ${phone ? `
                <div class="production-team-card-back-field">
                  <span>Phone</span>
                  <strong>${phone}</strong>
                </div>
              ` : ''}
              <div class="production-team-card-back-field">
                <span>Passcode</span>
                <div class="production-team-card-back-passcode-row" onclick="event.stopPropagation();">
                  <input id="passcode-input-${id}" class="production-team-card-back-input production-team-card-back-passcode" value="${passcode}" placeholder="6 digits" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" oninput="this.value=this.value.replace(/\\D+/g,'').slice(0,6)" />
                  <button class="production-team-card-back-icon" type="button" onclick="saveTeamMemberPasscode('${id}',this)" title="Save access code">Save</button>
                  <button class="production-team-card-back-icon" type="button" onclick="regenPasscode('${id}',this)" title="Generate new 6-digit passcode">↻</button>
                </div>
              </div>
              <div class="production-team-card-back-field production-team-card-back-bio">
                <span>Bio</span>
                <p>${bioText}</p>
              </div>
            </div>
            ${showManagement ? `
              <div class="production-team-card-back-actions" onclick="event.stopPropagation();">
                ${inviteHtml}
                <button class="production-team-card-back-action" type="button" onclick="copyTeamPortalLink('${id}',this)">Copy Link</button>
                <button class="production-team-card-back-action" type="button" onclick="copyProductionTeamCardPasscode('${id}',this)">Copy Code</button>
                ${bio ? `<button class="production-team-card-back-action" type="button" onclick="downloadTeamBio('${id}')">Bio ↓</button>` : ''}
                ${m.headshot_url ? `<a class="production-team-card-back-action" href="${escapeHtml(m.headshot_url)}" target="_blank" download>Headshot ↓</a>` : ''}
                <div class="production-team-card-back-hint">Click to flip back</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

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
  const orig = btn.textContent.trim();
  btn.classList.remove('did-work', 'is-clicked');
  void btn.offsetWidth;
  btn.classList.add('is-clicked');
  setTimeout(() => btn.classList.remove('is-clicked'), 420);
  btn.classList.add('is-working');
  btn.disabled = true;
  if (working) btn.textContent = working;
  return function ptcMarkDone(success = true) {
    btn.classList.remove('is-working');
    btn.disabled = false;
    if (success) {
      btn.textContent = done;
      btn.classList.add('did-work');
      if (restore) {
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('did-work');
        }, timeout);
      }
    } else {
      btn.textContent = orig;
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
