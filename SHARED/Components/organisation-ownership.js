/* Organisation ownership is separate from job titles and workspace roles. */
(function () {
  'use strict';
  let candidates = [];
  let latestLink = '';
  async function load(client, organisation, user) {
    const form = document.getElementById('ownership-transfer-form');
    const message = document.getElementById('ownership-transfer-message');
    if (!form || !message) return;
    form.hidden = true;
    if (organisation.admin_id !== user.id) { message.textContent = 'Only the organisation owner can transfer ownership.'; return; }
    const select = document.getElementById('ownership-recipient');
    const { data, error } = await client.rpc('bts_ownership_transfer_candidates', { p_organisation_id: organisation.id });
    if (error) { message.textContent = 'We could not load eligible members. Please try again.'; return; }
    candidates = data || [];
    select.replaceChildren();
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose an accepted member'; select.appendChild(empty);
    for (const member of candidates) {
      const option = document.createElement('option'); option.value = member.user_id;
      option.textContent = member.display_name + ' (' + member.email + ')'; select.appendChild(option);
    }
    if (!candidates.length) { message.textContent = 'Invite the next owner as a member first. They must accept, verify their email and confirm their adult account before ownership can be transferred.'; return; }
    form.hidden = false;
    message.textContent = 'The next owner must accept using their own account. Ownership stays with you until then.';
    form.onsubmit = async event => {
      event.preventDefault();
      const recipient = candidates.find(member => member.user_id === select.value);
      if (!recipient) { message.textContent = 'Choose the intended next owner.'; return; }
      const button = document.getElementById('ownership-create-link'); button.disabled = true;
      try {
        const { data, error } = await client.rpc('bts_start_ownership_transfer', { p_organisation_id: organisation.id, p_recipient_id: recipient.user_id });
        if (error) throw error;
        const link = new URL('/member/account/transfer', location.origin); link.searchParams.set('token',data.token);
        latestLink = link.toString();
        const output = document.getElementById('ownership-transfer-link'); output.value = latestLink; output.hidden = false;
        document.getElementById('ownership-copy-link').hidden = false;
        message.textContent = 'Share this link directly with ' + recipient.email + '. It expires in 24 hours. No email has been sent. Creating another link replaces this one.';
      } catch (error) { message.textContent = error.message || 'We could not create the ownership invitation.'; }
      finally { button.disabled = false; }
    };
    document.getElementById('ownership-copy-link').onclick = async () => {
      try { await navigator.clipboard.writeText(latestLink); message.textContent = 'Ownership link copied. Share it directly with the intended recipient.'; }
      catch { message.textContent = 'Select and copy the link above.'; }
    };
  }
  window.BTSOrganisationOwnership = { load };
}());
