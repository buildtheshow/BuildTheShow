/* A correction changes domain records; login identity and permissions remain server-owned. */
(function () {
  'use strict';
  function mount(client, container, context = {}) {
    if (!container || container.dataset.correctionMounted) return;
    container.dataset.correctionMounted = 'true';
    const organisationPage = context.type === 'organisation';
    const heading = document.createElement('div');
    heading.className = organisationPage ? 'sp-card-title' : 'section-card-title';
    heading.textContent = 'Correct profile type';
    const description = document.createElement('p');
    description.className = organisationPage ? 'sp-card-desc' : 'section-card-subtitle';
    description.textContent = 'Set up as a person when it should be an organisation, or the other way around? Correct it here. Your adult login stays the same.';
    const open = document.createElement('button');
    open.type = 'button'; open.className = organisationPage ? 'btn-secondary' : 'btn-save';
    open.textContent = 'Review profile correction';
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
        ].filter(item => !organisationPage || (item.type === 'organisation' && item.id === context.id));
        if (sources.length) {
          const form = document.createElement('form');
          const source = field(form, 'Profile to correct', 'select');
          option(source, '', 'Choose the profile');
          for (const item of sources) option(source, item.type + ':' + item.id, (item.type === 'member' ? 'Person: ' : 'Organisation: ') + item.name);
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
              text(fields, 'This member profile will become organisation setup. Personal details, photos and date of birth are not copied to the organisation.');
              existing = field(fields, 'Organisation', 'select');
              option(existing, '', 'Create the correct organisation');
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
              text(fields, 'This mistaken organisation will be archived. Your existing personal profile will be used, or a personal profile will be created for you. Organisation details are not copied into your personal profile.');
              if (!(data.members || []).length) { name = field(targetFields, 'Your own name', 'text', data.person_name || ''); name.required = true; name.maxLength = 150; }
            }
            fields.append(targetFields);
            text(fields, 'Unused profiles can be corrected immediately. Productions, bookings, shared access or other linked records require review first. No records are deleted.');
            const confirmation = document.createElement('label'); confirmation.className = 'del-chk-row';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.required = true;
            confirmation.append(checkbox, document.createTextNode(' I confirm this profile was set up as the wrong type. If it can be corrected safely, archive the mistaken profile and use the correct one.'));
            const confirmationGroup = document.createElement('div'); confirmationGroup.className = 'form-group';
            confirmationGroup.append(confirmation); fields.append(confirmationGroup);
            const submit = document.createElement('button'); submit.type = 'submit';
            submit.className = organisationPage ? 'btn-primary' : 'btn-save'; submit.textContent = 'Confirm correction';
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
                  const link = document.createElement('a'); link.textContent = 'Open the corrected profile';
                  // Only locally constructed destinations are used, never server-provided arbitrary URLs.
                  link.href = (result.data.target_type === 'organisation' ? '/org/dashboard?id=' : '/member/profile?id=') + encodeURIComponent(result.data.target_id);
                  message.append(document.createTextNode(' '), link);
                }
              } catch (failure) { message.textContent = failure.message || 'The correction could not be completed. Please try again.'; }
              finally { submit.disabled = false; source.disabled = false; open.disabled = false; }
            };
          };
          source.onchange = renderCorrection;
          const current = sources.find(item => item.id === context.id && item.type === context.type);
          const initial = current || (sources.length === 1 ? sources[0] : null);
          if (initial) source.value = initial.type + ':' + initial.id;
          renderCorrection();
        } else text(content, 'This login has no personal profile or owned organisation available to correct here. Check that you are signed into the login that created it. Child profiles and profiles managed for another adult cannot be converted.');
        for (const item of data.history || []) text(content, (item.state === 'needs_review' ? 'Review required' : item.state === 'completed' ? 'Completed' : 'Declined') + ': ' + item.source_type + ' to ' + item.target_type + '. Reference: ' + item.id + (item.reason ? '. ' + item.reason : ''));
      } catch (failure) { message.textContent = failure.message || 'Profile correction is unavailable. Please try again.'; }
      finally { open.disabled = false; }
    };
  }
  window.BTSProfileTypeCorrection = {mount};
}());
