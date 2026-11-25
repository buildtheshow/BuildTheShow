import {mountPrivateContacts} from './profile-contacts.js?v=20261125-member-completion';
import {supabase as client} from '/ASSETS/scripts/supabase.js';
import {clone, readPath, collectProfile, validateUpload, safeMediaLink, ROLE_KEYS} from './profile-data.js?v=20261121-profile-editor';
import '/SHARED/Components/private-profile-media.js?v=20261116-private-routes';

const $ = id => document.getElementById(id);
const root = $('profile-editor');
const form = $('profile-form');
const fallback = '/ASSETS/Images/Icons/performer2.svg';
const fieldNodes = new Map();
const resumeSlots = new Map();
let profile, user, profileId, identityEditable = false, ready = false, dirty = false, saving = false;
let photos = [], activeTab = 'performer', previewing = false;
const touched = new Set();
const SELECT = (...items) => items.map(item => Array.isArray(item) ? item : [item, item]);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, callback, className) {
  const node = el('button', text, className);
  node.type = 'button';
  node.addEventListener('click', callback);
  return node;
}
function setStatus(message, error = false) {
  $('profile-save-status').textContent = message;
  $('profile-save-status').classList.toggle('pm-error', error);
  $('profile-save-status').setAttribute('role', error ? 'alert' : 'status');
}
function changed(path) {
  dirty = true;
  if (path) touched.add(path);
  setStatus('Unsaved changes');
}
function block(tab, title, hint, open = false) {
  const panel = $('panel-' + tab);
  const details = el('details', '', 'pm-block');
  details.open = open;
  details.dataset.title = title;
  const summary = el('summary');
  const arrow = el('span', '⌄');
  arrow.setAttribute('aria-hidden', 'true');
  summary.append(el('strong', title), el('span', hint, 'pm-summary'), arrow);
  const fields = el('div', '', 'pm-fields');
  details.append(summary, fields);
  panel.append(details);
  details.addEventListener('toggle', () => {
    if (details.open) panel.querySelectorAll('details').forEach(peer => { if (peer !== details) peer.open = false; });
  });
  return fields;
}
function field(parent, path, label, options = {}) {
  const wrapper = el('label', label);
  const input = el(options.choices ? 'select' : options.rows ? 'textarea' : 'input');
  input.id = 'field-' + path.replaceAll('.', '-');
  input.dataset.path = path;
  if (options.choices) {
    const choices = options.choices.slice();
    const saved = readPath(profile, path);
    if (saved && !choices.some(([value]) => value === saved)) choices.push([saved, saved]);
    for (const [value, text] of choices) input.add(new Option(text, value));
  } else if (options.rows) input.rows = options.rows;
  else input.type = options.type || 'text';
  input.value = readPath(profile, path) ?? '';
  input.placeholder = options.placeholder || '';
  input.maxLength = options.rows ? 10000 : 1000;
  const identity = ['credit_name'].includes(path);
  input.disabled = path === 'date_of_birth' || (identity && !identityEditable);
  if (path === 'date_of_birth') wrapper.append(el('small', 'Kept with this person’s private profile details.'));
  input.addEventListener('input', () => changed(path));
  input.addEventListener('change', () => changed(path));
  wrapper.append(input);
  parent.append(wrapper);
  if (!input.disabled) fieldNodes.set(path, input);
  return input;
}
function historyBlock(tab, title) {
  const fields = block(tab, title, 'Production title, organisation, role and year', true);
  const entries = el('div', '', 'pm-history');
  entries.dataset.history = tab;
  fields.append(entries);
  function addRow(saved = {}, markDirty = true) {
    const entry = el('div', '', 'pm-history-entry');
    const grid = el('div', '', 'pm-fields pm-two');
    for (const [key, label] of [['title','Production title'], ['organisation','Organisation'], ['role','Role'], ['year','Year'], ...(tab === 'volunteer' ? [['description','What did you do?']] : [])]) {
      const wrapper = el('label', label);
      const input = el(key === 'description' ? 'textarea' : 'input');
      if (key === 'description') input.rows = 2;
      input.dataset.historyField = key;
      input.setAttribute('aria-label', label);
      input.maxLength = key === 'description' ? 5000 : 500;
      input.value = saved[key] || '';
      input.addEventListener('input', () => changed('sections.' + tab + '.history'));
      wrapper.append(input);
      grid.append(wrapper);
    }
    entry.append(grid, button('Remove entry', () => { entry.remove(); changed('sections.' + tab + '.history'); }, 'pm-remove'));
    entries.append(entry);
    if (markDirty) { changed('sections.' + tab + '.history'); entry.querySelector('input').focus(); }
  }
  for (const item of profile.sections?.[tab]?.history || []) addRow(item, false);
  if (!entries.children.length) addRow({}, false);
  fields.append(button('Add another production', () => {
    if (entries.children.length >= 100) { setStatus('Keep up to 100 productions in each history.', true); return; }
    addRow();
  }));
  return fields;
}
function resume(parent, path) {
  const slot = {url: readPath(profile, path) || '', file: null, name: ''};
  resumeSlots.set(path, slot);
  const row = el('div', '', 'pm-file-row');
  const label = el('label', 'Resume / CV · PDF, up to 5 MB');
  const input = el('input'); input.type = 'file'; input.accept = 'application/pdf';
  const name = el('span', '', 'pm-hint');
  const view = button('View saved PDF', () => window.BTSPrivateMedia.open(slot.url, '_blank'));
  const remove = button('Remove file', () => { slot.file = null; slot.uploaded = null; slot.url = ''; slot.name = ''; input.value = ''; render(); changed(path); });
  function render() { name.textContent = slot.name || (slot.url ? 'Resume / CV saved' : 'No file added'); view.hidden = !slot.url || !!slot.file; remove.hidden = !slot.url && !slot.file; }
  input.addEventListener('change', () => {
    try { const file = input.files[0]; if (!file) return; validateUpload(file, 'resume'); slot.file = file; slot.uploaded = null; slot.name = file.name; render(); changed(path); }
    catch (error) { setStatus(error.message, true); }
    input.value = '';
  });
  slot.render = render;
  label.append(input); row.append(label, name, view, remove); parent.append(row); render();
}
function renderFields() {
  let area = block('performer', 'Basics', 'Name, pronouns and date of birth');
  area.classList.add('pm-two');
  field(area, 'credit_name', 'Name used on programmes and credits');
  field(area, 'pronouns', 'Pronouns', {placeholder:'Optional'});
  field(area, 'date_of_birth', 'Date of birth', {type:'date'});
  field(area, 'nickname', 'Preferred name', {placeholder:'Optional'});
  area = block('performer', 'Bio', 'A short introduction', true);
  const bio = field(area, 'bio', 'Bio', {rows:3});
  bio.parentElement.classList.add('pm-bio-label');
  area = block('performer', 'Experience', 'Productions, roles and other experience');
  field(area, 'sections.performer.acting_level', 'Acting experience', {choices:SELECT(['','Choose if relevant'], ['first-show','First production'], ['some','Some experience'], ['experienced','Experienced'], ['professional','Professional'])});
  field(area, 'sections.performer.experience', 'Previous productions and roles', {rows:3, placeholder:'Production, role, organisation and year, if you know them.'});
  area = block('performer', 'Dance', 'Styles and experience'); area.classList.add('pm-two');
  field(area, 'sections.performer.dance_styles', 'Styles');
  field(area, 'sections.performer.dance_level', 'Experience', {choices:SELECT(['','Choose if relevant'], ['none','No experience'], ['beginner','Beginner'], ['intermediate','Intermediate'], ['advanced','Advanced'])});
  area = block('performer', 'Singing', 'Range and comfort'); area.classList.add('pm-two');
  field(area, 'sections.performer.voice_type', 'Vocal range', {choices:SELECT(['','Not sure yet'],'Soprano','Mezzo-Soprano','Alto','Tenor','Baritone','Bass','Non-singing','Other')});
  field(area, 'sections.performer.vocal_comfort', 'Singing comfort', {choices:SELECT(['','Choose if relevant'],['prefer-not','Prefer not to sing'],['chorus','Comfortable in chorus'],['harmonies','Comfortable with harmonies'],['solos','Comfortable singing solos'])});
  area = block('performer', 'Training & skills', 'Classes, instruments, accents and more');
  field(area, 'sections.performer.training', 'Training', {rows:2});
  for (const [key,label] of [['instruments','Instruments'],['accents','Accents'],['combat','Stage combat'],['other_skills','Other skills']]) field(area, 'sections.performer.' + key, label);
  area = block('performer', 'Appearance', 'Optional casting details'); area.classList.add('pm-two');
  for (const [key,label] of [['height','Height'],['eye_colour','Eye colour'],['hair_colour','Hair colour']]) field(area, 'sections.performer.' + key, label);
  resume(block('performer', 'Resume / CV', 'Optional PDF'), 'sections.performer.resume_url');
  field(block('performer', 'Media', 'Singing clips, showreels and more'), 'sections.performer.media_url', 'Video or audio link', {type:'url', placeholder:'https://'});

  historyBlock('volunteer', 'Volunteer history');
  area = block('volunteer', 'Skills & interests', 'What you know and what you’d like to try');
  field(area, 'sections.volunteer.experience', 'Experience and skills', {rows:2});
  field(area, 'sections.volunteer.interests_text', 'Interested in trying', {rows:2});
  const olderSkills = profile.sections?.volunteer?.skills;
  const olderInterests = profile.sections?.volunteer?.interests;
  if (olderSkills || olderInterests) {
    const saved = el('p', 'Previously saved: ' + [Object.entries(olderSkills || {}).map(([skill, level]) => skill.replaceAll('-', ' ') + ' (' + level + ')').join(', '), (olderInterests || []).join(', ')].filter(Boolean).join(' · '), 'pm-hint');
    area.append(saved);
  }
  field(block('volunteer', 'Training', 'Courses, workshops and certificates'), 'sections.volunteer.training', 'Training', {rows:2});
  area = block('volunteer', 'Working together', 'General availability and preferences');
  field(area, 'sections.volunteer.availability', 'General availability');
  field(area, 'sections.volunteer.preferences', 'Preferences', {rows:2});
  field(area, 'sections.volunteer.support_needs', 'Support needs', {rows:2});

  area = historyBlock('creative', 'Creative history');
  const roles = profile.sections?.creative?.roles || {};
  const earlier = Object.entries(roles).filter(([,value]) => value?.experience);
  if (earlier.length) {
    const legacy = el('details', '', 'pm-legacy');
    legacy.append(el('summary', 'Earlier saved experience'));
    for (const [role, data] of earlier) {
      const label = el('label', role.replaceAll('_',' '));
      const input = el('textarea'); input.rows = 2; input.value = data.experience;
      input.dataset.path = 'sections.creative.roles.' + role + '.experience';
      fieldNodes.set(input.dataset.path, input); input.addEventListener('input', () => changed(input.dataset.path));
      label.append(input); legacy.append(label);
    }
    area.append(legacy);
  }
  area = block('creative', 'Training & skills', 'Courses, teaching and practical skills');
  field(area, 'sections.creative.training', 'Training', {rows:2});
  field(area, 'sections.creative.skills', 'Skills', {rows:2});
  area = block('creative', 'Portfolio & Resume / CV', 'Examples of your work');
  field(area, 'sections.creative.portfolio_url', 'Portfolio link', {type:'url', placeholder:'https://'});
  resume(area, 'sections.creative.resume_url');
}
async function signedPhoto(photo) {
  if (photo.preview) return photo.preview;
  if (photo.url) return window.BTSPrivateMedia.authorisedUrl(photo.url);
  return fallback;
}
function renderPhotos() {
  const container = $('profile-headshots'); container.replaceChildren();
  photos.forEach((photo, index) => {
    const item = el('div', '', 'pm-photo-item');
    const img = el('img'); img.alt = 'Headshot ' + (index + 1);
    const shot = button('', () => { photos.splice(index, 1); photos.unshift(photo); renderPhotos(); changed('photos'); }, 'pm-shot');
    shot.setAttribute('aria-label', index ? 'Set photo ' + (index + 1) + ' as primary' : 'Primary headshot');
    shot.setAttribute('aria-pressed', String(index === 0));
    shot.append(img, el('small', index ? 'Set primary' : 'Primary'));
    // Resolve private images before assigning src, rather than requesting a public URL first.
    signedPhoto(photo).then(url => { img.src = url; }).catch(() => { img.src = fallback; setStatus('A saved photo could not load. It has not been removed.', true); });
    item.append(shot, button('Remove', () => { photos.splice(index, 1); renderPhotos(); changed('photos'); }, 'pm-remove'));
    container.append(item);
  });
  if (photos.length < 5) {
    const add = button('', () => $('profile-photo-input').click(), 'pm-upload');
    const icon = el('img'); icon.src = '/ASSETS/Images/Icons/upload.svg'; icon.alt = '';
    add.append(icon, el('span', 'Add a photo')); container.append(add);
  }
  syncSidebarPhoto();
}
async function syncSidebarPhoto() {
  const photo = photos[0];
  try {
    const src = photo ? await signedPhoto(photo) : fallback;
    if (photo !== photos[0]) return;
    const img = el('img'); img.src = src; img.alt = '';
    $('sidebar-avatar-placeholder').replaceChildren(img);
  } catch { /* A failed signed read never falls back to a public request. */ }
}
function switchTab(tab) {
  activeTab = tab;
  for (const node of root.querySelectorAll('[data-tab]')) {
    const selected = node.dataset.tab === tab;
    node.classList.toggle('chosen', selected); node.setAttribute('aria-selected', String(selected)); node.tabIndex = selected ? 0 : -1;
    $('panel-' + node.dataset.tab).hidden = !selected;
  }
  $('profile-tab-note').textContent = ({performer:'Fill in the sections you need. You can come back to the rest.',volunteer:'The productions you’ve helped with and what you did.',creative:'Your creative work, role by role. Add paid or volunteer work.',headshots:'One set of photos for auditions, volunteering and creative work.',contacts:'Contact and emergency details for this person. Kept private until you choose to share them.'})[tab];
  $('profile-preview-toggle').hidden=tab==='contacts';
  $('profile-save').hidden=tab==='contacts';$('profile-privacy').hidden=tab==='contacts';
  if(tab==='contacts'&&previewing){previewing=false;$('profile-panels').hidden=false;$('profile-preview').hidden=true;$('profile-preview-toggle').textContent='Preview profile';$('profile-preview-toggle').setAttribute('aria-expanded','false');}
  if (previewing) renderPreview();
}
function renderPreview() {
  const preview = $('profile-preview'); preview.replaceChildren();
  preview.append(el('h2', fieldNodes.get('credit_name')?.value || profile.credit_name || 'Profile preview'));
  preview.append(el('p', 'Only a preview. Nothing is published or sent.', 'pm-hint'));
  if (activeTab === 'headshots') {
    const strip = el('div', '', 'pm-photo-strip'); preview.append(strip);
    for (const photo of photos) {
      const img = el('img'); img.alt = 'Headshot'; img.className = 'pm-preview-photo';
      signedPhoto(photo).then(url => { img.src = url; }).catch(() => { img.src = fallback; }); strip.append(img);
    }
    return;
  }
  for (const detail of $('panel-' + activeTab).children) {
    const section = el('section', '', 'pm-preview-section'); section.append(el('h3', detail.dataset.title));
    for (const input of detail.querySelectorAll('[data-path]')) {
      if (!input.value) continue;
      const text = input.tagName === 'SELECT' ? input.selectedOptions[0]?.textContent : input.value;
      section.append(el('p', (input.parentElement.firstChild?.textContent || '') + ': ' + text));
    }
    for (const row of detail.querySelectorAll('.pm-history-entry')) {
      const values = [...row.querySelectorAll('[data-history-field]')].map(input => input.value.trim()).filter(Boolean);
      if (values.length) section.append(el('p', values.join(' · ')));
    }
    for (const [path, slot] of resumeSlots) if (path.includes('.' + activeTab + '.') && detail.contains([...detail.querySelectorAll('input[type=file]')][0]) && (slot.file || slot.url)) section.append(el('p', slot.name || 'Resume / CV saved'));
    if (section.childElementCount > 1) preview.append(section);
  }
}
function snapshot() {
  const values = Object.fromEntries([...fieldNodes].map(([path, input]) => [path, input.value.trim()]));
  const histories = {};
  for (const key of ['volunteer','creative']) histories[key] = [...root.querySelectorAll('[data-history="' + key + '"] .pm-history-entry')].map(row => Object.fromEntries([...row.querySelectorAll('[data-history-field]')].map(input => [input.dataset.historyField, input.value])));
  const update = collectProfile(profile, values, histories);
  for (const key of ROLE_KEYS) {
    if ([...touched].some(path => path.startsWith('sections.' + key + '.')) && Object.values(update.sections[key] || {}).some(value => typeof value === 'string' ? value.trim() : Array.isArray(value) ? value.length : false)) update.sections[key].enabled = true;
  }
  return update;
}
async function upload(file, kind) {
  const extension = validateUpload(file, kind);
  // New, immutable paths keep older application attachments unchanged.
  const path = user.id + '/' + profileId + '/' + Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2,'0')).join('') + '.' + extension;
  const {error} = await client.storage.from('profile-headshots').upload(path, file, {upsert:false, contentType:file.type});
  if (error) throw new Error(kind === 'photo' ? 'A photo could not upload. Nothing was saved. Try again.' : 'Your Resume / CV could not upload. Nothing was saved. Try again.');
  // This canonical reference is not a publicly readable URL. The bucket is private.
  const {data} = client.storage.from('profile-headshots').getPublicUrl(path);
  const canonical = data.publicUrl;
  const binding = await client.rpc('bts_bind_profile_file', {p_profile_id:profileId, p_url:canonical});
  if (binding.error || binding.data !== true) throw new Error('The file uploaded but could not be attached to this profile. Try saving again.');
  return canonical;
}
async function save(event) {
  event?.preventDefault();
  if (!ready || saving) return;
  let update;
  try { update = snapshot(); }
  catch (error) { setStatus(error.message, true); return; }
  saving = true; form.inert = true; $('profile-save').disabled = true;
  setStatus('Saving…');
  try {
    const permission = await client.rpc('bts_profile_access', {p_profile_id:profileId,p_manage:true});
    if (permission.error || permission.data !== true) throw new Error('You no longer have permission to edit this profile. Your changes have not been saved.');
    for (const photo of photos) if (photo.file && !photo.uploaded) photo.uploaded = await upload(photo.file, 'photo');
    update.headshot_urls = photos.map(photo => photo.uploaded || photo.url);
    update.headshot_url = update.headshot_urls[0] || null;
    for (const [path, slot] of resumeSlots) {
      if (slot.file && !slot.uploaded) slot.uploaded = await upload(slot.file, 'resume');
      const [,key,property] = path.split('.');
      update.sections[key] ||= {};
      update.sections[key][property] = slot.uploaded || slot.url || null;
    }
    let query = client.from('profiles').update(update).eq('id', profileId);
    // Refuse to overwrite a save made by another tab or another authorised adult.
    for (const key of ['sections','bio','headshot_url','headshot_urls','credit_name','nickname','pronouns']) {
      query = profile[key] == null ? query.is(key,null) : query.eq(key,key === 'sections' ? JSON.stringify(profile[key]) : key === 'headshot_urls' ? '{' + profile[key].map(value=>JSON.stringify(value)).join(',') + '}' : profile[key]);
    }
    const {data,error} = await query.select('id').maybeSingle();
    if (error) throw new Error('Your profile could not save. Your changes are still here. Try again.');
    if (!data?.id) throw new Error('This profile changed in another window, or your access changed. Copy your unsaved text before reloading.');
    profile = {...profile, ...clone(update)};
    photos.forEach(photo => { photo.url = photo.uploaded || photo.url; photo.file = null; photo.uploaded = null; });
    for (const [path, slot] of resumeSlots) { slot.url = readPath(profile,path); slot.file = null; slot.uploaded = null; slot.render(); }
    dirty = false; touched.clear();
    sessionStorage.setItem('bts_active_profile_name', profile.credit_name || 'My Profile');
    sessionStorage.setItem('bts_active_profile_sections', JSON.stringify(Object.fromEntries(ROLE_KEYS.map(key => [key,{enabled:!!profile.sections?.[key]?.enabled}]))));
    window.renderMemberSidebar('profiles'); await syncSidebarPhoto();
    setStatus('Saved. Nothing has been published or sent.');
    renderPhotos();
  } catch (error) { setStatus(error.message || 'Could not save. Your changes are still here.', true); }
  finally { saving = false; form.inert = false; $('profile-save').disabled = false; }
}
async function init() {
  $('profile-retry').hidden = true;
  try {
    const {data:{session},error} = await client.auth.getSession();
    if (error || !session) { location.replace('/login?return=' + encodeURIComponent(location.pathname)); return; }
    user = session.user;
    if (!await window.BTSAccountSecurity.ensureAdultAccount(client)) return;
    const match = location.pathname.match(/^\/member\/profiles\/([^/]+)\/edit$/);
    profileId = match?.[1] || new URLSearchParams(location.search).get('id') || sessionStorage.getItem('bts_active_profile_id');
    if (!profileId) { location.replace('/member/profiles'); return; }
    if(location.hash==='#profile-settings'){location.replace('/member/settings?section=profiles&profile='+encodeURIComponent(profileId));return;}
    const access = await client.rpc('bts_profile_access',{p_profile_id:profileId,p_manage:true});
    if (access.error || access.data !== true) throw new Error('This profile is not available to edit with your account.');
    const result = await client.from('profiles').select('id,credit_name,nickname,pronouns,date_of_birth,bio,headshot_url,headshot_urls,sections,profile_display_id').eq('id',profileId).single();
    if (result.error || !result.data) throw new Error('Your profile could not load. Try again.');
    profile = result.data;
    const identity = await client.rpc('bts_profile_identity_edit',{p_profile_id:profileId});
    identityEditable = !identity.error && identity.data === true;
    photos = (profile.headshot_urls?.length ? profile.headshot_urls : profile.headshot_url ? [profile.headshot_url] : []).slice(0,5).map(url => ({url}));
    sessionStorage.setItem('bts_active_profile_id',profileId);
    sessionStorage.setItem('bts_active_profile_name',profile.credit_name || 'My Profile');
    sessionStorage.setItem('bts_active_profile_custom_id',profile.profile_display_id || '');
    window.sb = client;
    window.renderMemberSidebar('profiles');
    $('sidebar-email').textContent = user.email || '';
    document.title = 'My Profile | Build The Show';
    renderFields(); renderPhotos(); switchTab('performer');
    mountPrivateContacts(client,$('profile-private-contacts'),profileId);
    ready = true; form.hidden = false; $('profile-load-status').hidden = true;
  } catch (error) { $('profile-load-status').textContent = error.message; $('profile-retry').hidden = false; }
}
form.addEventListener('submit',save);
$('profile-retry').addEventListener('click',()=>location.reload());
$('profile-photo-input').addEventListener('change',async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file || photos.length >= 5) return;
  try {
    validateUpload(file,'photo');
    const preview = URL.createObjectURL(file);
    const image = new Image(); image.src = preview;
    try { await image.decode(); } catch { URL.revokeObjectURL(preview); throw new Error('This photo could not be opened. Choose another JPG, PNG or WebP.'); }
    if (saving || photos.length >= 5) { URL.revokeObjectURL(preview); return; }
    photos.push({file,preview}); renderPhotos(); changed('photos');
  } catch(error) { setStatus(error.message,true); }
});
root.querySelectorAll('[data-tab]').forEach(node => {
  node.addEventListener('click',()=>switchTab(node.dataset.tab));
  node.addEventListener('keydown',event=>{
    const tabs=[...root.querySelectorAll('[data-tab]')]; let index=tabs.indexOf(node);
    if(event.key==='ArrowRight')index=(index+1)%tabs.length;
    else if(event.key==='ArrowLeft')index=(index+tabs.length-1)%tabs.length;
    else if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else return;
    event.preventDefault();tabs[index].focus();switchTab(tabs[index].dataset.tab);
  });
});
$('profile-preview-toggle').addEventListener('click',()=>{
  previewing=!previewing;$('profile-panels').hidden=previewing;$('profile-preview').hidden=!previewing;
  $('profile-preview-toggle').textContent=previewing?'Keep editing':'Preview profile';$('profile-preview-toggle').setAttribute('aria-expanded',String(previewing));
  if(previewing)renderPreview();
});
$('profile-logout').addEventListener('click',async()=>{if(dirty&&!confirm('Leave without saving your profile changes?'))return;dirty=false;await client.auth.signOut();location.replace('/login');});
window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
function menu(open){const narrow=matchMedia('(max-width:850px)').matches;document.body.classList.toggle('member-profile-nav-open',open&&narrow);$('profile-nav-shade').hidden=!open||!narrow;$('profile-nav-open').setAttribute('aria-expanded',String(open&&narrow));$('profile-sidebar').inert=narrow&&!open;}
$('profile-nav-open').onclick=()=>{menu(true);$('profile-nav-close').focus();};$('profile-nav-close').onclick=()=>{menu(false);$('profile-nav-open').focus();};$('profile-nav-shade').onclick=()=>menu(false);window.addEventListener('resize',()=>menu(false));document.addEventListener('keydown',e=>{if(e.key==='Escape')menu(false);});menu(false);
init();
