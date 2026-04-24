/**
 * Shared production team access actions.
 * Used by the production workspace and the team portal workspace.
 */

function teamPortalUrl() {
  const abbrev = orgAbbreviation || orgSlug || 'team';
  const showSlug = prod?.slug || generateSlug(prod?.title || 'show');
  return new URL(`/${abbrev}/${showSlug}/Team`, window.location.origin).toString();
}

function randomTeamPasscode() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
}

async function regenPasscode(memberId, btn) {
  const code = randomTeamPasscode();
  const input = document.getElementById(`passcode-input-${memberId}`);
  if (input) input.value = code;
  const markDone = ptcBtnFeedback?.(btn, { working: 'Saving...', done: 'Saved' });
  const ok = await saveTeamMemberField(memberId, 'passcode', code, { render: false });
  markDone?.(ok !== false);
}

async function saveTeamMemberPasscode(memberId, btn) {
  const input = document.getElementById(`passcode-input-${memberId}`);
  const markDone = ptcBtnFeedback?.(btn, { working: 'Saving...', done: 'Saved' });
  const ok = await saveTeamMemberField(memberId, 'passcode', input?.value || '', { render: false });
  markDone?.(ok !== false);
}

function nextAvailableTeamColor(memberId = null) {
  const used = new Set((auditionTeamMembers || [])
    .filter(m => m.id !== memberId && m.is_active !== false)
    .map(m => String(m.note_color || '').toLowerCase())
    .filter(Boolean));
  return TEAM_NOTE_COLORS.find(color => !used.has(color.toLowerCase())) || TEAM_NOTE_COLORS[0];
}

function findCreativeRoleForTeamMember(member) {
  const creative = teamConfig?.find(d => d.name === 'Creative Team');
  if (!creative) return null;
  const memberId = String(member?.id || '');
  const memberName = String(member?.name || '').trim().toLowerCase();
  const memberRole = String(member?.role || '').trim().toLowerCase();
  const memberEmail = String(member?.email || '').trim().toLowerCase();
  return (creative.roles || []).find(role =>
    String(role.team_member_id || '') === memberId
    || (
      String(role.name || '').trim().toLowerCase() === memberRole
      && String(role.person || '').trim().toLowerCase() === memberName
    )
    || (
      memberEmail
      && String(role.email || '').trim().toLowerCase() === memberEmail
    )
  ) || null;
}

async function syncTeamMemberToProductionTeam(member, patch = {}) {
  if (!member || !teamConfig) return;
  const role = findCreativeRoleForTeamMember(member);
  if (!role) return;
  if (Object.prototype.hasOwnProperty.call(patch, 'name')) role.person = patch.name || '';
  if (Object.prototype.hasOwnProperty.call(patch, 'email')) role.email = patch.email || '';
  if (Object.prototype.hasOwnProperty.call(patch, 'role')) role.name = patch.role || role.name || '';
  role.team_member_id = member.id;
  role.filled = Boolean(role.person);
  await saveTeamConfig();
}

async function upsertTeamAccessForCreativeRole(role) {
  if (!role?.person?.trim()) return;
  await loadAuditionTeamMembers();
  const existing = auditionTeamMembers.find(m =>
    String(m.id || '') === String(role.team_member_id || '') ||
    String(m.role || '').toLowerCase() === String(role.name || '').toLowerCase() &&
    String(m.name || '').toLowerCase() === String(role.person || '').toLowerCase()
  );
  const payload = {
    name: role.person.trim(),
    email: role.email || null,
    role: role.name,
    note_color: existing?.note_color || nextAvailableTeamColor(existing?.id),
    is_active: true,
  };
  if (existing) {
    await sb.from('production_team_members').update(payload).eq('id', existing.id);
    role.team_member_id = existing.id;
    await saveTeamConfig();
    return;
  }
  const { data } = await sb.from('production_team_members').insert({
    production_id: prodId,
    ...payload,
    passcode: randomTeamPasscode(),
  }).select('id').single();
  if (data?.id) {
    role.team_member_id = data.id;
    await saveTeamConfig();
  }
}

async function syncCreativeRolesToTeamAccess(options = {}) {
  const creative = teamConfig?.find(d => d.name === 'Creative Team');
  const roles = (creative?.roles || []).filter(r => r.person && r.person.trim());
  if (!roles.length) {
    if (!options.silent) showToast('Add names to the Creative Team first.', true);
    return;
  }
  await loadAuditionTeamMembers();
  for (const role of roles) {
    await upsertTeamAccessForCreativeRole(role);
  }
  await loadAuditionTeamMembers();
  renderTeamView(document.getElementById('tm-container'));
  if (!options.silent) showToast('Production team audition access is ready.');
}

function showAddTeamMemberForm() {
  const form = document.getElementById('add-team-member-form');
  if (!form) return;
  form.style.display = 'block';
  document.getElementById('new-tm-name')?.focus();
}

async function addTeamMemberDirect() {
  const name = document.getElementById('new-tm-name')?.value?.trim();
  const email = document.getElementById('new-tm-email')?.value?.trim();
  const role = document.getElementById('new-tm-role')?.value?.trim();
  const err = document.getElementById('add-tm-error');
  if (err) err.textContent = '';
  if (!name) { if (err) err.textContent = 'Enter a name.'; return; }
  if (!email) { if (err) err.textContent = 'Enter an email address.'; return; }
  if (!role) { if (err) err.textContent = 'Enter a role.'; return; }
  await loadAuditionTeamMembers();
  const duplicate = auditionTeamMembers.find(m => m.email?.toLowerCase() === email.toLowerCase());
  if (duplicate) { if (err) err.textContent = 'That email already has access.'; return; }
  const { data, error } = await sb.from('production_team_members').insert({
    production_id: prodId,
    name,
    email,
    role,
    passcode: randomTeamPasscode(),
    note_color: nextAvailableTeamColor(),
    is_active: true,
  }).select('*').single();
  if (error) { if (err) err.textContent = 'Could not add: ' + error.message; return; }
  await syncTeamMemberToProductionTeam(data, { name, email, role });
  document.getElementById('new-tm-name').value = '';
  document.getElementById('new-tm-email').value = '';
  document.getElementById('new-tm-role').value = '';
  document.getElementById('add-team-member-form').style.display = 'none';
  await loadAuditionTeamMembers();
  renderTeamView(document.getElementById('tm-container'));
  showToast(`${name} added. Send them the invite from the access row below.`);
}

async function saveTeamMemberField(memberId, field, value, options = {}) {
  if (!['name', 'email', 'role', 'passcode'].includes(field)) return false;
  const shouldRender = options.render !== false;
  const patch = { [field]: String(value || '').trim() || null };
  if (field === 'passcode') {
    const digits = String(value || '').replace(/\D+/g, '').slice(0, 6);
    if (digits.length !== 6) {
      const existing = auditionTeamMembers.find(m => String(m.id) === String(memberId));
      const input = document.getElementById(`passcode-input-${memberId}`);
      if (input) input.value = existing?.passcode || '';
      showToast('Access code must be exactly 6 numbers.', true);
      return false;
    }
    patch.passcode = digits;
    const input = document.getElementById(`passcode-input-${memberId}`);
    if (input) input.value = patch.passcode;
  }
  const existing = auditionTeamMembers.find(m => String(m.id) === String(memberId));
  const { error } = await sb.from('production_team_members').update(patch).eq('id', memberId);
  if (error) { showToast('Could not save team access: ' + error.message, true); return false; }
  await syncTeamMemberToProductionTeam({ ...(existing || {}), id: memberId }, patch);
  if (existing) Object.assign(existing, patch);
  await loadAuditionTeamMembers();
  if (shouldRender) renderTeamView(document.getElementById('tm-container'));
  return true;
}

function openProductionTeamMemberEdit(memberId) {
  const member = auditionTeamMembers.find(m => String(m.id) === String(memberId));
  if (!member) return;
  const safe = typeof esc === 'function'
    ? esc
    : (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]));
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'production-team-member-edit-modal';
  overlay.onclick = event => {
    if (event.target === overlay) closeProductionTeamMemberEdit();
  };
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:620px;width:min(94vw,620px);" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div>
          <div class="modal-title">Edit Team Member</div>
          <div class="modal-subtitle">Update the details shown on their production team card.</div>
        </div>
        <button class="modal-close" type="button" aria-label="Close" onclick="closeProductionTeamMemberEdit()">×</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">
        <label>
          <span style="display:block;font-size:0.78rem;font-weight:800;margin-bottom:0.3rem;">Name</span>
          <input id="ptm-edit-name" class="form-input" value="${safe(member.name || '')}" />
        </label>
        <label>
          <span style="display:block;font-size:0.78rem;font-weight:800;margin-bottom:0.3rem;">Role</span>
          <input id="ptm-edit-role" class="form-input" value="${safe(member.role || '')}" />
        </label>
        <label>
          <span style="display:block;font-size:0.78rem;font-weight:800;margin-bottom:0.3rem;">Email</span>
          <input id="ptm-edit-email" class="form-input" type="email" value="${safe(member.email || '')}" />
        </label>
        <label>
          <span style="display:block;font-size:0.78rem;font-weight:800;margin-bottom:0.3rem;">Phone</span>
          <input id="ptm-edit-phone" class="form-input" type="tel" value="${safe(member.phone || member.phone_number || '')}" />
        </label>
        <label>
          <span style="display:block;font-size:0.78rem;font-weight:800;margin-bottom:0.3rem;">Card Colour</span>
          <input id="ptm-edit-color" class="form-input" type="color" value="${safe(member.note_color || nextAvailableTeamColor(member.id))}" style="height:42px;padding:0.2rem;" />
        </label>
      </div>
      <label style="display:block;margin-top:0.8rem;">
        <span style="display:block;font-size:0.78rem;font-weight:800;margin-bottom:0.3rem;">Bio</span>
        <textarea id="ptm-edit-bio" class="form-textarea" style="min-height:130px;">${safe(member.bio || '')}</textarea>
      </label>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-top:0.95rem;">
        <div id="ptm-edit-msg" style="font-size:0.8rem;color:#8a7aa4;"></div>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn-secondary" type="button" onclick="closeProductionTeamMemberEdit()">Cancel</button>
          <button class="btn-primary" type="button" onclick="saveProductionTeamMemberEdit('${safe(member.id)}', this)">Save</button>
        </div>
      </div>
    </div>`;
  document.getElementById('production-team-member-edit-modal')?.remove();
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('ptm-edit-name')?.focus(), 50);
}

function closeProductionTeamMemberEdit() {
  document.getElementById('production-team-member-edit-modal')?.remove();
}

async function saveProductionTeamMemberEdit(memberId, btn = null) {
  const msg = document.getElementById('ptm-edit-msg');
  const payload = {
    name: (document.getElementById('ptm-edit-name')?.value || '').trim(),
    role: (document.getElementById('ptm-edit-role')?.value || '').trim(),
    email: (document.getElementById('ptm-edit-email')?.value || '').trim().toLowerCase(),
    phone: (document.getElementById('ptm-edit-phone')?.value || '').trim() || null,
    bio: document.getElementById('ptm-edit-bio')?.value || '',
    note_color: document.getElementById('ptm-edit-color')?.value || nextAvailableTeamColor(memberId),
  };
  if (!payload.name) {
    if (msg) { msg.style.color = '#b91c1c'; msg.textContent = 'Name is required.'; }
    return;
  }
  if (!payload.role) {
    if (msg) { msg.style.color = '#b91c1c'; msg.textContent = 'Role is required.'; }
    return;
  }
  if (!payload.email) {
    if (msg) { msg.style.color = '#b91c1c'; msg.textContent = 'Email is required.'; }
    return;
  }
  const markDone = ptcBtnFeedback?.(btn, { working: 'Saving...', done: 'Saved' });
  const { data, error } = await sb
    .from('production_team_members')
    .update(payload)
    .eq('production_id', prodId)
    .eq('id', memberId)
    .select('*')
    .single();
  if (error) {
    markDone?.(false);
    if (msg) { msg.style.color = '#b91c1c'; msg.textContent = 'Could not save: ' + error.message; }
    return;
  }
  await syncTeamMemberToProductionTeam(data || { id: memberId }, payload);
  await loadAuditionTeamMembers();
  markDone?.(true);
  closeProductionTeamMemberEdit();
  renderTeamView(document.getElementById('tm-container'));
  showToast('Team member updated.');
}

async function toggleTeamMemberAccess(memberId, isActive) {
  const { error } = await sb.from('production_team_members').update({ is_active: isActive === true }).eq('id', memberId);
  if (error) { showToast('Could not update team access: ' + error.message, true); return; }
  await loadAuditionTeamMembers();
  renderTeamView(document.getElementById('tm-container'));
}

async function copyTeamPortalLink(memberId = null, btn = null) {
  const member = auditionTeamMembers.find(m => m.id === memberId) || null;
  const link = teamPortalUrl();
  const markDone = ptcBtnFeedback?.(btn, { done: 'Copied' });
  try {
    await navigator.clipboard.writeText(link);
    markDone?.(true);
    showToast(member ? `Copied ${member.name}'s audition link.` : 'Copied team audition portal link.');
  } catch {
    markDone?.(false);
    prompt('Copy this audition team link:', link);
  }
}

async function removeProductionTeamMember(memberId, btn = null) {
  const member = auditionTeamMembers.find(m => String(m.id) === String(memberId));
  if (!member) return;
  const label = member.name || member.email || 'this team member';
  const ok = window.confirm([
    `Remove ${label}?`,
    '',
    'This will permanently delete:',
    '- their team access email and passcode',
    '- saved team login sessions',
    '- all audition notes they wrote',
    '- their team profile details',
    '',
    'This cannot be undone.'
  ].join('\n'));
  if (!ok) return;

  const markDone = ptcBtnFeedback?.(btn, { working: 'Removing', done: 'Removed', restore: false });
  try {
    if (member.headshot_path) {
      const { error: fileError } = await sb.storage.from('audition-headshots').remove([member.headshot_path]);
      if (fileError) console.warn('[BTS] Could not remove team headshot file.', fileError);
    }

    let removedWithRpc = false;
    const { error: rpcError } = await sb.rpc('remove_production_team_member', {
      p_production_id: prodId,
      p_team_member_id: memberId
    });

    if (!rpcError) {
      removedWithRpc = true;
    } else {
      console.warn('[BTS] remove_production_team_member RPC unavailable; using direct cleanup.', rpcError);
    }

    if (!removedWithRpc) {
      const { error: notesError } = await sb
        .from('production_audition_notes')
        .delete()
        .eq('production_id', prodId)
        .eq('team_member_id', memberId);
      if (notesError) throw notesError;

      const { error: sessionsError } = await sb
        .from('production_team_member_sessions')
        .delete()
        .eq('production_id', prodId)
        .eq('team_member_id', memberId);
      if (sessionsError) throw sessionsError;

      const { error: memberError } = await sb
        .from('production_team_members')
        .delete()
        .eq('production_id', prodId)
        .eq('id', memberId);
      if (memberError) throw memberError;
    }

    const role = findCreativeRoleForTeamMember(member);
    if (role) {
      role.team_member_id = null;
      role.email = '';
      await saveTeamConfig();
    }

    if (Array.isArray(auditionAuthoredNotes)) {
      auditionAuthoredNotes = auditionAuthoredNotes.filter(note => String(note.team_member_id || '') !== String(memberId));
    }

    auditionTeamMembers = auditionTeamMembers.filter(m => String(m.id) !== String(memberId));
    markDone?.(true);
    setTimeout(() => renderTeamView(document.getElementById('tm-container')), 500);
    showToast(`${label} and their team notes were removed.`);
  } catch (error) {
    console.error('[BTS] Remove team member failed.', error);
    markDone?.(false);
    showToast('Could not remove team member: ' + (error.message || 'Please try again.'), true);
  }
}

function teamInviteMessage(member) {
  const link = teamPortalUrl();
  const prodTitle = prod?.title || 'this production';
  const role = member.role || 'a team member';
  const lines = [
    `Hi ${member.name || 'there'},`,
    '',
    `You've been added to the audition team for ${prodTitle} as ${role}.`,
    '',
    '-----------------------------',
    'YOUR LOGIN DETAILS',
    '-----------------------------',
    `Portal link:  ${link}`,
    `Email:        ${member.email || ''}`,
    `Access code:  ${member.passcode || ''}`,
    '-----------------------------',
    '',
    'HOW TO GET IN:',
    `1. Click the portal link above (or copy and paste it into your browser).`,
    `2. Enter your email address: ${member.email || ''}`,
    `3. Enter your access code: ${member.passcode || ''}`,
    `4. Click "Open Auditions."`,
    '',
    'ONCE YOU\'RE IN:',
    '- Go to the Profile tab first. Choose your note colour and add a headshot and bio.',
    '- Use "In The Room" during auditions to pull up performer cards and write notes.',
    '- Your notes are saved to your name and visible to the full team in real time.',
    '',
    `If you have any trouble logging in, reply to this email and we'll sort it out.`,
    '',
    `${orgName || 'The production team'}`
  ];
  return lines.join('\n');
}

function teamInviteSubstituteTokens(text, member) {
  if (!text) return '';
  const link = teamPortalUrl();
  return text
    .split('{{team_member_name}}').join(member.name || 'there')
    .split('{{team_member_role}}').join(member.role || 'a team member')
    .split('{{team_member_email}}').join(member.email || '')
    .split('{{team_access_code}}').join(member.passcode || '')
    .split('{{portal_link}}').join(link)
    .split('{{show_name}}').join(prod?.title || 'this production')
    .split('{{org_name}}').join(orgName || 'The production team')
    .split('{{director_name}}').join(prod?.director || '');
}

async function emailTeamInvite(memberId, clickedBtn = null) {
  const member = auditionTeamMembers.find(m => m.id === memberId);
  if (!member) return;
  if (!member.email) {
    showToast('Add an email address before sending the invite.', true);
    return;
  }

  const btn = clickedBtn || document.getElementById(`invite-btn-${memberId}`);
  const markDone = ptcBtnFeedback?.(btn, { working: 'Sending...', done: 'Sent', restore: false });

  const liveTemplate = etLatestTemplateForCategory('team_invite');
  let subject, message;
  if (liveTemplate) {
    subject = teamInviteSubstituteTokens(liveTemplate.subject, member);
    message = teamInviteSubstituteTokens(liveTemplate.body, member);
  } else {
    subject = `${prod?.title || 'Production'} audition team access`;
    message = teamInviteMessage(member);
  }
  try {
    const { data, error } = await sb.functions.invoke('send-email', {
      body: {
        production_id: prodId,
        category: 'general',
        email: member.email,
        name: member.name || member.email,
        subject,
        message,
        context: {
          performer_email: member.email,
          performer_name: member.name || member.email,
          show_name: prod?.title || '',
          show_subtitle: prod?.subtitle || '',
          org_name: orgName || '',
          org_email: orgEmail || '',
          production: {
            title: prod?.title || '',
            subtitle: prod?.subtitle || '',
            venue: prod?.venue || '',
            director: prod?.director || '',
            organization_id: prod?.organization_id || '',
            org_name: orgName || '',
          },
        },
      },
    });
    if (error || !data?.sent) throw new Error(error?.message || data?.error || 'Email was not sent.');
    await sb.from('production_team_members').update({ invite_sent_at: new Date().toISOString() }).eq('id', memberId);
    markDone?.(true);
    await loadAuditionTeamMembers();
    setTimeout(() => renderTeamView(document.getElementById('tm-container')), 900);
    showToast(`Invite emailed to ${member.name || member.email}.`);
  } catch (err) {
    markDone?.(false);
    const mailto = `mailto:${encodeURIComponent(member.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = mailto;
    showToast('Could not send automatically - your email app is opening with the invite ready.', true);
  }
}

function downloadTeamBio(memberId) {
  const member = auditionTeamMembers.find(m => m.id === memberId);
  if (!member?.bio) { showToast('No bio has been added yet.', true); return; }
  const text = `${member.name || 'Team Member'}\n${member.role || ''}\n\n${member.bio || ''}`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(member.name || 'team-member').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-bio.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
