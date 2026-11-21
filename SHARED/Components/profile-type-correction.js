/* A correction changes domain records; login identity and permissions remain server-owned. */
(function () {
  'use strict';
  function mount(client, container, context = {}) {
    if (!container || container.dataset.correctionMounted) return;
    container.dataset.correctionMounted = 'true';
    const organisationPage = context.type === 'organisation';
    const heading = document.createElement('div');
    heading.className = organisationPage ? 'sp-card-title' : 'section-card-title';
    heading.textContent = 'Change profile type';
    const description = document.createElement('p');
    description.className = organisationPage ? 'sp-card-desc' : 'section-card-subtitle';
    description.textContent = 'Change a Member profile to an Organisation, or an Organisation to a Member. This does not change Performer, Creative Team or Volunteer roles. Your login stays the same.';
    const open = document.createElement('button');
    open.type = 'button'; open.className = organisationPage ? 'btn-secondary' : 'btn-save';
    open.textContent = 'Review profile type change';
    const content = document.createElement('div');
    const message = document.createElement('p');
    message.className = organisationPage ? 'sp-card-desc' : 'section-card-subtitle';
    message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
    container.append(heading, description, open, content, message);
    let fieldCount = 0;
    function field(parent, label, type, value = '') {
      const group = document.createElement('div'); group.className = 'form-group';
      const caption = document.createElement('label'); caption.className = 'form-label';
      caption.textContent = label;
      const input = document.createElement(type === 'select' ? 'select' : 'input');
      input.className = 'form-input';
      if (type !== 'select') input.type = type;
      input.value = value;
      input.id = container.id + '-field-' + (++fieldCount); caption.htmlFor = input.id;
      group.append(caption, input); parent.append(group);
      return input;
    }
    function option(select, value, label) { select.add(new Option(label, value)); }
    function text(parent, value) { const p = document.createElement('p'); p.className = organisationPage ? 'sp-card-desc' : 'section-card-subtitle'; p.textContent = value; parent.append(p); }
    open.onclick = async () => {
      open.disabled = true; message.textContent = ''; content.replaceChildren();
      try {
        const {data, error} = await client.rpc('bts_profile_type_options');
        if (error) throw error;
        const sources = [
          ...(data.members || []).map(item => ({...item, type: 'member'})),
          ...(data.organisations || []).map(item => ({...item, type: 'organisation'}))
        ].filter(item => context.selectedOnly ? item.type === context.type && item.id === context.id : !organisationPage || (item.type === 'organisation' && item.id === context.id));
        if (sources.length) {
          const form = document.createElement('form');
          const source = field(form, 'Profile to change', 'select');
          option(source, '', 'Choose the profile');
          for (const item of sources) option(source, item.type + ':' + item.id, (item.type === 'member' ? 'Member: ' : 'Organisation: ') + item.name);
          source.required = true;
          const fields = document.createElement('div');
          form.append(fields); content.append(form);
          const renderCorrection = () => {
            fields.replaceChildren(); message.textContent = '';
            const selected = sources.find(item => item.type + ':' + item.id === source.value);
            form.onsubmit = event => event.preventDefault();
            if (!selected) return;
            const type = selected.type;
            const targetFields = document.createElement('div');
            let existing, name, email, slug;
            if (type === 'member') {
              text(fields, 'Member → Organisation. The member profile will be archived. Its personal details, photos and date of birth will not carry over. You will set up an organisation, or use one you already own.');
              existing = field(fields, 'Organisation', 'select');
              option(existing, '', 'Create a new organisation');
              for (const item of data.organisations || []) option(existing, item.id, 'Use existing: ' + item.name);
              name = field(targetFields, 'Organisation name', 'text'); name.maxLength = 150;
              email = field(targetFields, 'Organisation contact email', 'email');
              slug = field(targetFields, 'Organisation address (buildtheshow.com/your-name)', 'text');
              slug.pattern = '[a-z0-9]+(-[a-z0-9]+)*'; slug.minLength = 3; slug.maxLength = 50;
              const toggle = () => {
                targetFields.hidden = Boolean(existing.value);
                for (const input of [name, email, slug]) { input.disabled = Boolean(existing.value); input.required = !existing.value; }
              };
              existing.onchange = toggle; toggle();
              text(targetFields, 'The new organisation starts private. You can finish its details in Organisation Settings.');
            } else {
              text(fields, 'Organisation → Member. The organisation will be archived. Its details will not carry over. You will use your existing member profile, or create one if you do not have one.');
              if (!(data.members || []).length) { name = field(targetFields, 'Your own name', 'text', data.person_name || ''); name.required = true; name.maxLength = 150; }
            }
            fields.append(targetFields);
            text(fields, 'The old profile will leave active use. Its information stays in the archive; it is not permanently deleted. Information is not transferred between types. If you use an existing destination profile, its information stays as it is. Productions, bookings or shared access need review before a change can go ahead.');
            const confirmation = document.createElement('label'); confirmation.className = 'del-chk-row';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.required = true;
            confirmation.append(checkbox, document.createTextNode(' I understand that the old profile will be archived and its information will not carry over. I want to change between Member and Organisation.'));
            const confirmationGroup = document.createElement('div'); confirmationGroup.className = 'form-group';
            confirmationGroup.append(confirmation); fields.append(confirmationGroup);
            const submit = document.createElement('button'); submit.type = 'submit';
            submit.className = organisationPage ? 'btn-primary' : 'btn-save'; submit.textContent = 'Confirm profile type change';
            fields.append(submit);
            form.onsubmit = async event => {
              event.preventDefault(); if (!form.reportValidity() || submit.disabled) return;
              const details = type === 'member' ? (existing.value ? {organisation_id: existing.value} : {name: name.value.trim(), email: email.value.trim(), slug: slug.value.trim()}) : {person_name: name?.value.trim() || ''};
              submit.disabled = true; source.disabled = true; open.disabled = true; message.textContent = '';
              try {
                const result = await client.rpc('bts_correct_profile_type', {p_source_type: type, p_source_id: selected.id, p_details: details, p_confirmed: checkbox.checked});
                if (result.error) throw result.error;
                message.textContent = result.data.message + ' Reference: ' + result.data.id;
                if (result.data.state === 'completed') {
                  form.remove();
                  if (type === 'member' && sessionStorage.getItem('bts_active_profile_id') === selected.id) sessionStorage.removeItem('bts_active_profile_id');
                  if (result.data.target_type === 'member') sessionStorage.setItem('bts_active_profile_id', result.data.target_id);
                  const link = document.createElement('a'); link.textContent = 'Open profile';
                  // Only locally constructed destinations are used, never server-provided arbitrary URLs.
                  link.href = (result.data.target_type === 'organisation' ? '/org?id=' : '/member/profiles/') + encodeURIComponent(result.data.target_id);
                  message.append(document.createTextNode(' '), link);
                }
              } catch (failure) { message.textContent = failure.message || 'The profile type change could not be completed. Please try again.'; }
              finally { submit.disabled = false; source.disabled = false; open.disabled = false; }
            };
          };
          source.onchange = renderCorrection;
          const current = sources.find(item => item.id === context.id && item.type === context.type);
          const initial = current || (sources.length === 1 ? sources[0] : null);
          if (initial) source.value = initial.type + ':' + initial.id;
          renderCorrection();
        } else text(content, 'There is no profile available to change here. You can only change your own adult member profile or an organisation you own. Sign in with the account that created it. Children’s profiles and profiles you manage for another adult cannot change type.');
        for (const item of data.history || []) text(content, (item.state === 'needs_review' ? 'Review required' : item.state === 'completed' ? 'Completed' : 'Declined') + ': ' + item.source_type + ' to ' + item.target_type + '. Reference: ' + item.id + (item.reason ? '. ' + item.reason : ''));
      } catch (failure) { message.textContent = failure.message || 'Profile type changes are unavailable. Please try again.'; }
      finally { open.disabled = false; }
    };
  }
  window.BTSProfileTypeCorrection = {mount};
}());
