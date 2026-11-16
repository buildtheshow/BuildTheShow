import { supabase as client } from '/ASSETS/scripts/supabase.js';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let snapshot = { profiles:[], households:[], invites:[], reviews:[] };
let selected = null;
const stored = 'bts_household_confirmation';
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('invite') || hash.get('consent') || hash.get('unsubscribe')) {
  sessionStorage.setItem(stored, JSON.stringify({ token:hash.get('invite') || hash.get('consent') || hash.get('unsubscribe'), mode:hash.get('invite') ? 'invite' : hash.get('consent') ? 'consent' : 'unsubscribe' }));
  history.replaceState(null, '', location.pathname + location.search);
}
let confirmation;
try { confirmation = JSON.parse(sessionStorage.getItem(stored) || 'null'); } catch { sessionStorage.removeItem(stored); }
function message(text) { $('family-status').textContent = text;$('family-status').hidden = false; }
async function rpc(action, data = {}) {
  const { data:result, error } = await client.rpc('bts_family', { p_action:action, p_data:data });
  if (error) throw error;return result;
}
async function work(callback, button) {
  if (button) button.disabled = true;
  try { await callback(); } catch (error) { message(error.code === 'P0001' ? error.message : 'We could not complete this request. Please try again.'); }
  finally { if (button) button.disabled = false; }
}
const kindLabel = { self:'Your own profile', child:'Guardian-managed child', adult:'Managed adult', legacy:'Existing profile: choose how it is managed' };
function renderProfiles() {
  $('family-profiles').innerHTML = snapshot.profiles.map(p => `<article class="family-person"><h3>${esc(p.name || 'Performer')}</h3><p>${esc(kindLabel[p.kind] || p.kind)}</p><p>${p.needs_adult_claim ? 'This performer is now an adult. Guardian access has ended; request activation of their own account.' : p.state === 'pending' ? 'Waiting for the adult to confirm permission.' : p.state === 'active' ? 'Access active' : esc(p.state)}</p>${p.can_manage ? `<button data-profile="${esc(p.id)}">Open access and payments</button><a class="family-link secondary" href="/member/profile?id=${encodeURIComponent(p.id)}">View profile</a>` : ''}${p.kind === 'adult' && ['pending','declined'].includes(p.state) ? `<button data-permission-retry="${esc(p.id)}">${p.state==='pending'?'Change or resend permission request':'Review needed after declined permission'}</button><button class="secondary" data-cancel-pending="${esc(p.id)}">Archive unconfirmed profile</button>` : ''}${p.kind === 'legacy' ? `<button data-adopt="${esc(p.id)}">Confirm profile relationship</button>` : ''}${p.needs_adult_claim ? `<button data-adult-review="${esc(p.id)}">Request adult activation</button>` : ''}</article>`).join('') || '<p>No profiles yet. Add yourself or someone you are authorised to help.</p>';
}
function renderHouseholds() {
  $('family-households').innerHTML = snapshot.households.map(h => `<div class="family-row"><strong>${esc(h.name)}</strong><p>${h.creator ? 'You are the household creator.' : 'You have a household key.'} ${(h.members || []).length} adult key holder(s).</p><p>${(h.profiles || []).map(id => esc(snapshot.profiles.find(p => p.id === id)?.name || 'Authorised performer')+(h.creator ? ` <button class="secondary" data-detach-profile="${esc(id)}" data-detach-household="${esc(h.id)}">Remove household connection</button>` : '')).join(', ') || 'No authorised performer connections to show.'}</p>${h.creator ? `<button data-household-invite="${esc(h.id)}">Invite a household key</button>` : `<button class="secondary" data-leave-household="${esc(h.id)}">Leave household</button>`}</div>`).join('') || '<p>No household needed if you are organising only yourself. You can create one whenever it helps.</p>';
  $('attach-household').innerHTML = snapshot.households.filter(h => h.creator).map(h => `<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('');
}
function renderInvites() {
  $('family-invites').innerHTML = snapshot.invites.map(i => {
    const expired = i.state === 'pending' && new Date(i.expires_at) < new Date();
    return `<div class="family-row"><strong>${esc(i.email)}</strong><p>${esc(i.kind)}: ${expired ? 'expired' : esc(i.state)}. Email: ${esc(i.mail_state || 'queued')}.</p>${i.state === 'pending' ? `<button class="secondary" data-revoke="${esc(i.id)}">Cancel invitation</button>` : ''}</div>`;
  }).join('') || '<p>No invitations yet.</p>';
  $('family-reviews').innerHTML = snapshot.reviews.map(r => `<div class="family-row">${esc(r.kind.replaceAll('_',' '))}: <strong>${esc(r.state)}</strong>${r.reason ? `<p>${esc(r.reason)}</p>` : ''}</div>`).join('') || '<p>No review requests.</p>';
}
async function load(refreshDetail = false) {
  snapshot = await rpc('snapshot');renderProfiles();renderHouseholds();renderInvites();
  if (selected) { selected = snapshot.profiles.find(p => p.id === selected.id) || null;if (selected && refreshDetail) await openPerson(selected.id); }
}
function money(cents, currency) {
  try { return new Intl.NumberFormat('en-CA', { style:'currency', currency }).format(cents/100); }
  catch { return (cents/100).toFixed(2) + ' ' + currency; }
}
async function renderPayments() {
  if (!selected?.can_manage) return;
  const { data, error } = await client.rpc('bts_family_tracker', { p_profile_id:selected.id });
  if (error) throw error;
  $('family-payments').innerHTML = (data || []).map(invoice => {
    const bill = window.BTSFamilyPayments.summary(invoice);
    return `<article class="family-row"><h4>${esc(invoice.title)}</h4>${invoice.shared_invoice ? '<p>This is the shared production invoice. It shows the full billing-group balance without opening other performers\u0027 private profiles.</p>' : ''}${invoice.legacy_payments?.length ? '<p><strong>Balance needs staff confirmation.</strong> Older household payments need reconciliation before this total is final. They are listed separately below.</p>' : ''}<p>Fees after discounts: <strong>${esc(money(bill.total,bill.currency))}</strong><br>Discounts: ${esc(money(bill.discount,bill.currency))}<br>Recorded paid: ${esc(money(bill.paid,bill.currency))}<br>Remaining: <strong>${esc(money(bill.balance,bill.currency))}</strong>${bill.credit ? '<br>Credit: '+esc(money(bill.credit,bill.currency)) : ''}</p><table><caption>Payment schedule</caption><thead><tr><th scope="col">Payment</th><th scope="col">Due</th><th scope="col">Amount</th><th scope="col">Left</th></tr></thead><tbody>${bill.schedule.map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.due || 'Not set')}</td><td>${esc(money(row.cents,bill.currency))}</td><td>${esc(money(row.remaining,bill.currency))}</td></tr>`).join('')}</tbody></table><h4>Recorded payments</h4>${bill.records.map(row => `<p>${esc(row.paid_at ? new Date(row.paid_at).toLocaleDateString('en-CA') : 'Date not recorded')}: ${esc(money(row.cents,bill.currency))}${row.paid_by ? ' · '+esc(row.paid_by) : ''}</p>`).join('') || '<p>No payments recorded.</p>'}${invoice.legacy_payments?.length ? '<h4>Older household payments awaiting reconciliation</h4><p>These are not counted again in the total above. Ask production staff to check them.</p>'+invoice.legacy_payments.map(row=>'<p>'+esc(money(row.amount_cents,bill.currency))+' · '+esc(row.paid_at ? new Date(row.paid_at).toLocaleDateString('en-CA') : 'Date not recorded')+'</p>').join('') : ''}</article>`;
  }).join('') || '<p>No production fee records are connected yet. These appear after a production creates the registration fee record.</p>';
}
async function openPerson(id) {
  selected = snapshot.profiles.find(p => p.id === id);if (!selected) return;
  $('family-person-details').hidden = false;$('detail-title').textContent = selected.name + ': access and payments';
  $('detail-access-note').textContent = selected.access_manager ? 'You manage invitations for this profile. Guardian removals require a protected review.' : 'You can manage this performer. The primary manager controls additional invitations.';
  $('invite-form').hidden = !selected.access_manager;$('review-form').hidden = !selected.access_manager;$('attach-household-form').hidden = !snapshot.households.some(h => h.creator);
  const options = selected.kind === 'child' ? [['guardian','Manage this child using their own login'],['contact','Receive emails only']] : [['contact','Receive emails only'],...(selected.is_subject ? [['delegate_key','Manage bookings using their own login']] : [['claim','Activate the adult performer\u0027s own login']])];
  $('invite-kind').innerHTML = options.map(([value,label]) => `<option value="${value}">${esc(label)}</option>`).join('');
  $('invite-volunteer').checked=false;$('invite-volunteer-row').hidden=$('invite-kind').value!=='delegate_key';
  const detail = await rpc('details',{ profile_id:id });
  $('detail-keys').innerHTML = '<h3>Who can manage this performer?</h3>' + (detail.keys || []).map(k => `<div class="family-row">${esc(k.name || (k.is_me ? 'You' : 'Adult key holder'))}: ${esc(k.kind)}${k.is_manager ? ' · primary manager' : ''}${!k.active ? ' · inactive' : ''}${k.is_me && !k.is_manager ? '<button class="secondary" data-leave-profile>Stop my access</button>' : ''}${selected.is_subject && k.kind==='delegate' && k.active ? `<button class="secondary" data-withdraw="${esc(k.user_id)}">Withdraw booking permission</button>` : ''}</div>`).join('');
  const refresh=document.createElement('button');refresh.textContent='Confirm my current account email for updates';refresh.onclick=()=>work(async()=>{await rpc('refresh_my_email',{profile_id:selected.id});message('Email confirmation queued.');},refresh);document.getElementById('refresh-family-email')?.remove();refresh.id='refresh-family-email';$('detail-contacts').after(refresh);
  $('detail-contacts').innerHTML = (detail.contacts || []).map(c => `<div class="family-row">${esc(c.email)} · ${c.active ? 'receives updates' : 'updates off'}${c.is_me || selected.access_manager && !c.protected_guardian ? `<button class="secondary" data-contact="${esc(c.id)}" data-enabled="${!c.active}">${c.active ? 'Turn updates off' : 'Turn updates on'}</button>` : ''}</div>`).join('') || '<p>No confirmed notification contacts yet.</p>';
  $('detail-history').innerHTML = (detail.history || []).map(a => `<p>${esc(new Date(a.at).toLocaleString('en-CA'))}: ${esc(a.action.replaceAll('_',' '))}${a.is_me ? ' · you' : ' · '+esc(a.actor || 'Authorised person')}</p>`).join('') || '<p>No recorded changes yet.</p>';
  $('review-user').innerHTML = '<option value="">Choose if relevant</option>'+(detail.keys || []).filter(k => !k.is_me).map(k => `<option value="${esc(k.user_id)}">${esc(k.name || k.kind)}</option>`).join('');
  const productions=document.createElement('div');productions.id='family-production-links';document.getElementById('family-production-links')?.remove();productions.innerHTML='<h3>Production records</h3>'+(detail.productions||[]).map(p=>`<p>${esc(p.title)} <a href="/member/applications">Open my auditions and registrations</a></p>`).join('');$('family-payments').before(productions);
  if(selected.kind==='adult'&&!selected.is_subject&&selected.access_manager){const button=document.createElement('button');button.textContent='Email the performer a login activation link';button.onclick=()=>work(async()=>{await rpc('request_adult_login',{profile_id:selected.id});message('Activation invitation queued for the adult who confirmed permission.');},button);productions.append(button);}
  await renderPayments();$('family-person-details').scrollIntoView({ behavior:'smooth', block:'start' });
}
function renderMap() {
  const views = {
    solo:'Your adult login → your performer profile → auditions → offers → registrations and payment tracking. A household is optional.',
    partners:'Your login → your own performer profile + a partner profile with confirmed permission. Household = organising folder. Your partner can activate a separate login later without making another performer profile.',
    guardians:'Parent A\u0027s login ─┐\n                           one child profile → auditions and registrations → one shared payment tracker\nParent B\u0027s login ─┘\nParent A and Parent B can keep separate households. Their keys open the child\u0027s profile, not each other\u0027s household.',
  };
  $('family-map').textContent = views[$('map-example').value];$('family-map').style.whiteSpace = 'pre-wrap';
}
$('map-example').addEventListener('change',renderMap);renderMap();
$('show-create-person').onclick = () => { $('create-person').hidden=false;$('person-name').focus(); };
$('person-kind').onchange = () => { $('person-email-wrap').hidden=$('person-kind').value!=='adult';$('person-guardian-wrap').hidden=$('person-kind').value!=='child'; };
$('person-form').onsubmit = event => { event.preventDefault();work(async () => {
  const name=$('person-name').value.trim();const kind=$('person-kind').value;
  const { error }=await client.rpc('bts_save_profile',{ p_profile:{ credit_name:name,legal_first_name:name.split(' ')[0],legal_last_name:name.split(' ').slice(1).join(' '),date_of_birth:$('person-birth').value,relationship_kind:kind,permission_email:kind==='adult'?$('person-email').value.trim():null,guardian_name:kind==='child'?$('person-guardian').value.trim():null },p_profile_id:null,p_guardian_confirmed:kind==='child'&&$('person-guardian-confirmed').checked });
  if(error)throw error;$('person-form').reset();$('create-person').hidden=true;await load();message(kind==='adult'?'Profile created. Permission is pending until the adult confirms their email invitation.':'Profile created.');
},event.submitter); };
$('household-form').onsubmit = event => { event.preventDefault();work(async()=>{await rpc('create_household',{name:$('household-name').value.trim()});$('household-name').value='';await load();message('Household created.');},event.submitter); };
$('invite-kind').onchange=()=>{$('invite-volunteer-row').hidden=$('invite-kind').value!=='delegate_key';$('invite-volunteer').checked=false;};
$('invite-form').onsubmit = event => { event.preventDefault();work(async()=>{await rpc('invite',{profile_id:selected.id,email:$('invite-email').value.trim(),kind:$('invite-kind').value,volunteer_help:$('invite-kind').value==='delegate_key'&&$('invite-volunteer').checked});$('invite-email').value='';await load();message('Invitation queued. Delivery status is shown below.');},event.submitter); };
$('attach-household-form').onsubmit = event => { event.preventDefault();work(async()=>{await rpc('add_to_household',{profile_id:selected.id,household_id:$('attach-household').value});await load();message('Household connection added. Access permissions stay separate.');},event.submitter); };
$('review-form').onsubmit = event => { event.preventDefault();work(async()=>{await rpc('review',{profile_id:selected.id,kind:$('review-kind').value,user_id:$('review-user').value,target_email:$('review-email').value.trim(),record_id:$('review-record').value.trim(),target_profile_id:$('review-record').value.trim(),table:$('review-table').value,date_of_birth:$('review-birth').value,explanation:$('review-explanation').value.trim()});await load();message('Review requested. No permissions or ownership have changed.');},event.submitter); };
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.profile)work(()=>openPerson(button.dataset.profile),button);
 if(button.dataset.permissionRetry)work(async()=>{const p=snapshot.profiles.find(p=>p.id===button.dataset.permissionRetry);if(p.state==='declined'){message('The adult declined permission. Do not resend without their agreement. You may archive this unconfirmed profile.');return;}const email=prompt('Adult performer email for their private permission confirmation:');if(!email)return;await rpc('invite',{profile_id:p.id,email,kind:'delegate'});await load();message('Permission invitation queued.');},button);
 if(button.dataset.cancelPending)work(async()=>{await rpc('archive_profile',{profile_id:button.dataset.cancelPending});await load();message('Unconfirmed profile archived.');},button);
 if(button.dataset.adopt)work(async()=>{const relation=prompt('Is this your own profile, a child, or another adult? Enter self, child, or adult.');if(!relation)return;const email=relation==='adult'?prompt('The other adult email for permission confirmation:'):null;await rpc('adopt_legacy',{profile_id:button.dataset.adopt,kind:relation,email,guardian_confirmed:relation==='child'&&confirm('I am this child\u0027s parent or legal guardian.'),name:relation==='child'?prompt('Your name as guardian:'):null});await load();message('Profile relationship recorded.');},button);
 if(button.dataset.householdInvite)work(async()=>{const email=prompt('Email for this household key? This does not grant performer access.');if(!email)return;await rpc('invite',{household_id:button.dataset.householdInvite,email,kind:'household'});await load();message('Household invitation queued.');},button);
 if(button.dataset.detachProfile)work(async()=>{await rpc('remove_from_household',{profile_id:button.dataset.detachProfile,household_id:button.dataset.detachHousehold});await load();message('Household connection removed. Profile access is unchanged.');},button);
 if(button.dataset.leaveHousehold)work(async()=>{await rpc('leave_household',{household_id:button.dataset.leaveHousehold});await load();},button);
 if(button.dataset.revoke)work(async()=>{await rpc('revoke_invite',{invite_id:button.dataset.revoke});await load();message('Invitation cancelled.');},button);
 if(button.hasAttribute('data-leave-profile'))work(async()=>{if(!confirm('Stop your access to this performer?'))return;await rpc('leave_profile',{profile_id:selected.id});selected=null;$('family-person-details').hidden=true;await load();},button);
 if(button.dataset.withdraw)work(async()=>{await rpc('withdraw_delegate',{profile_id:selected.id,user_id:button.dataset.withdraw});await openPerson(selected.id);message('Delegated access withdrawn.');},button);
 if(button.dataset.contact)work(async()=>{await rpc('contact_preference',{contact_id:button.dataset.contact,enabled:button.dataset.enabled==='true'});await openPerson(selected.id);message('Notification preference updated.');},button);
 if(button.dataset.adultReview){selected=snapshot.profiles.find(p=>p.id===button.dataset.adultReview);$('family-person-details').hidden=false;$('detail-title').textContent='Adult activation review';$('detail-access-note').textContent='Guardian access has ended. An operator must verify the adult before activating their own key.';$('invite-form').hidden=true;$('attach-household-form').hidden=true;$('review-form').hidden=false;$('review-kind').value='adult_activation';$('detail-keys').textContent='';$('detail-contacts').textContent='';$('detail-history').textContent='';$('family-payments').textContent='Private records are unavailable until adult access is confirmed.';}
 if(button.dataset.linkRecord)work(async()=>{const profile=$('link-person-'+button.dataset.linkRecord).value;await rpc('link_own_record',{profile_id:profile,record_id:button.dataset.linkRecord,table:button.dataset.table});await loadUnlinked();message('Your existing record is linked to the selected performer.');},button);
});
async function loadUnlinked(){const {data,error}=await client.rpc('bts_family_unlinked');if(error)throw error;$('family-unlinked').innerHTML=(data||[]).map(row=>`<div class="family-row"><strong>${esc(row.name)}</strong><p>${esc(row.production)} · ${esc(row.type)}</p><label>Connect to performer<select id="link-person-${esc(row.id)}">${snapshot.profiles.filter(p=>p.can_manage).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><button data-link-record="${esc(row.id)}" data-table="${esc(row.type)}">Connect my record</button></div>`).join('')||'<p>No unlinked records owned by this login.</p>';}
async function confirmationView(){
 $('family-confirmation').hidden=false;
 const consent=confirmation.mode==='consent';
 if(confirmation.mode==='unsubscribe'){ $('confirmation-copy').textContent='Turn off production updates sent to this email contact? Account access is unchanged.';$('confirmation-name').parentElement.hidden=true;$('confirmation-label').textContent='Turn off these email updates.';$('confirmation-accept').textContent='Turn updates off';$('confirmation-decline').hidden=true;$('confirmation-accept').onclick=event=>work(async()=>{if(!$('confirmation-check').checked)throw {code:'P0001',message:'Confirm the preference change.'};await rpc('unsubscribe',{token:confirmation.token});sessionStorage.removeItem(stored);$('family-confirmation').hidden=true;message('Email updates turned off.');},event.target);return; }
 const info=await rpc(consent?'consent_preview':'preview',{token:confirmation.token});
 $('confirmation-copy').textContent=consent?`Manage delegated permission for ${info.performer}. You can activate your own login or stop someone else handling bookings.`:`Invitation for ${info.performer||'a household'}: ${info.kind}. It was sent to ${info.email}.`;
 $('confirmation-label').textContent=info.kind==='guardian'?'I am this child\u0027s parent or legal guardian and I confirm this access.':'I confirm the permission described above.';
 $('confirmation-name').parentElement.hidden=info.kind!=='guardian';
 $('confirmation-accept').hidden=consent;$('confirmation-decline').hidden=consent;
 $('volunteer-help-wrap').hidden=info.kind!=='delegate';
 $('consent-volunteer').hidden=!consent;
 $('consent-volunteer').onclick=event=>work(async()=>{await rpc('allow_volunteer_help',{token:confirmation.token,confirmed:$('confirmation-check').checked});message('Volunteer signup help allowed for your authorised booking helpers.');},event.target);
 $('consent-activate').hidden=!consent;$('consent-withdraw').hidden=!consent;
 $('confirmation-login').hidden=!info.requires_login;
 $('confirmation-login').onclick=()=>BTSAccountSecurity.requireAdultLogin(client,'/member/households');
 $('confirmation-accept').onclick=event=>work(async()=>{if(info.requires_login&&!await BTSAccountSecurity.requireAdultLogin(client,'/member/households'))return;await rpc('accept',{token:confirmation.token,confirmed:$('confirmation-check').checked,guardian_confirmed:info.kind==='guardian'&&$('confirmation-check').checked,name:$('confirmation-name').value.trim(),volunteer_help:$('volunteer-help-check').checked});sessionStorage.removeItem(stored);confirmation=null;$('family-confirmation').hidden=true;message('Permission confirmed.');const {data}=await client.auth.getUser();if(data?.user){$('family-app').hidden=false;await load();await loadUnlinked();}},event.target);
 $('confirmation-decline').onclick=event=>work(async()=>{await rpc('decline',{token:confirmation.token});sessionStorage.removeItem(stored);$('family-confirmation').hidden=true;message('Invitation declined. No access was added.');},event.target);
 $('consent-activate').onclick=event=>work(async()=>{if(!await BTSAccountSecurity.requireAdultLogin(client,'/member/households'))return;await rpc('activate_profile',{token:confirmation.token,confirmed:$('confirmation-check').checked});message('Your own login now opens the existing performer profile.');await load();$('family-app').hidden=false;},event.target);
 $('consent-withdraw').onclick=event=>work(async()=>{await rpc('withdraw_permission',{token:confirmation.token,confirmed:$('confirmation-check').checked});message('Delegated management stopped.');},event.target);
}
await work(async()=>{
 if(confirmation)await confirmationView();
 const {data}=await client.auth.getUser();
 if(!data?.user){if(!confirmation)await BTSAccountSecurity.requireAdultLogin(client,'/member/households');return;}
 if(!await BTSAccountSecurity.ensureAdultAccount(client))return;
 $('family-app').hidden=false;await load();await loadUnlinked();
 const requestedProfile=new URLSearchParams(location.search).get('profile');if(requestedProfile&&snapshot.profiles.some(p=>p.id===requestedProfile&&p.can_manage))await openPerson(requestedProfile);
 if(new URLSearchParams(location.search).get('action')==='create-profile')$('create-person').hidden=false;
});
setInterval(()=>{if(document.visibilityState==='visible'&&!confirmation)work(async()=>{snapshot=await rpc('snapshot');renderInvites();if(selected?.can_manage)await renderPayments();});},30000);
