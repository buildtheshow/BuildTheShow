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
  const roleInitial = escapeHtml((m.role || '?').trim().charAt(0).toUpperCase() || '?');

  const photoHtml = m.headshot_url
    ? `<img src="${escapeHtml(m.headshot_url)}" alt="" class="production-team-card-image" />`
    : `<div class="production-team-card-placeholder">${initial}</div>`;

  const inviteHtml = m.invite_sent_at
    ? `<span class="production-team-card-sent" title="Sent ${escapeHtml(sentDate)}">Sent ✓</span><button id="invite-btn-${id}" class="btn-secondary" onclick="emailTeamInvite('${id}')">Resend</button>`
    : `<button id="invite-btn-${id}" class="btn-primary" onclick="emailTeamInvite('${id}')">Email Invite</button>`;

  const bio = String(m.bio || '');
  const bioHtml = bio
    ? `<div class="production-team-card-bio">${escapeHtml(bio).slice(0, 180)}${bio.length > 180 ? '…' : ''}</div>`
    : '';

  return `
    <div class="production-team-card-wrap" style="--pt-card-color:${color};">
      <div class="production-team-card${inactiveClass}">
        <div class="production-team-card-image-area">
          ${photoHtml}
          <div class="production-team-card-status-badge">${isActive ? 'ACTIVE' : 'OFF'}</div>
        </div>
        <div class="production-team-card-lower">
          <div class="production-team-card-accent">
            <div class="production-team-card-colour-chip" title="Team colour"></div>
            <div class="production-team-card-role-chip" title="${role || 'Role'}">${roleInitial}</div>
          </div>
          <div class="production-team-card-caption">
            <div class="production-team-card-name" title="${name}">${name || 'Unassigned'}</div>
            <div class="production-team-card-role" title="${role}">${role || 'Production Team'}</div>
            <div class="production-team-card-email" title="${email}">${email || 'No email'}</div>
          </div>
          <div class="production-team-card-mini-actions">
            <div class="production-team-card-mini-dot" title="Access code">#</div>
            <div class="production-team-card-mini-dot" title="Invite">${m.invite_sent_at ? '✓' : '@'}</div>
            <div class="production-team-card-mini-dot" title="Profile">${m.headshot_url ? 'H' : 'P'}</div>
          </div>
        </div>
      </div>
      ${showManagement ? `
        <div class="production-team-card-controls">
          <div class="production-team-card-fields">
            <input class="form-input production-team-card-name-input" value="${name}" placeholder="Full name" onblur="saveTeamMemberField('${id}','name',this.value)" />
            <input class="form-input production-team-card-role-input" value="${role}" placeholder="Role" onblur="saveTeamMemberField('${id}','role',this.value)" />
            <input class="form-input production-team-card-email-input" type="email" value="${email}" placeholder="Email address" onblur="saveTeamMemberField('${id}','email',this.value)" />
          </div>
          <div class="production-team-card-access">
            <input id="passcode-input-${id}" class="form-input production-team-card-code-input" value="${passcode}" placeholder="6-digit code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" oninput="this.value=this.value.replace(/\\D+/g,'').slice(0,6)" />
            <button class="production-team-card-save" onclick="saveTeamMemberPasscode('${id}')" title="Save access code">Save</button>
            <button class="production-team-card-regen" onclick="regenPasscode('${id}')" title="Generate new 6-digit passcode">↻</button>
            <label class="production-team-card-status ${statusClass}">
              <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleTeamMemberAccess('${id}',this.checked)" />
              ${isActive ? 'Active' : 'Inactive'}
            </label>
          </div>
          <div class="production-team-card-actions">
            ${inviteHtml}
            <button class="btn-secondary" onclick="copyTeamPortalLink('${id}')">Copy Link</button>
            ${bio ? `<button class="btn-secondary" onclick="downloadTeamBio('${id}')">Bio ↓</button>` : ''}
            ${m.headshot_url ? `<a class="btn-secondary" href="${escapeHtml(m.headshot_url)}" target="_blank" download style="text-decoration:none;">Headshot ↓</a>` : ''}
          </div>
          ${bioHtml}
        </div>
      ` : ''}
    </div>
  `;
}

