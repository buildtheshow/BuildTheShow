// Compact Activities, using the existing profile media and production-poster conventions.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>'/ASSETS/Images/Icons/'+name;
const live=row=>!['cancelled','canceled','declined','rejected','withdrawn','archived'].includes(row.status);
let mediaPromise;
export function imageUrl(value){try{const url=new URL(value,location.origin);return value&&['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}}
export async function enrichActivityMedia(client,model){
 const profiles=model.profiles.filter(p=>p.can_manage&&!p.needs_adult_claim).map(p=>p.id);
 const shows=model.productions.map(p=>p.id);
 const applicants=[...new Set(model.activities.flatMap(a=>[a.id,a.booking_id]).filter(Boolean))];
 const requests=[profiles.length?client.from('profiles').select('id,headshot_url').in('id',profiles):Promise.resolve({data:[]}),shows.length?client.from('bts_visible_productions').select('id,poster_url').in('id',shows):Promise.resolve({data:[]}),applicants.length?client.from('bts_participant_casting').select('id,production_id,applicant_id,character_id,state,dropped_out').in('applicant_id',applicants):Promise.resolve({data:[]})];
 const results=await Promise.allSettled(requests);
 const rows=results.map(r=>r.status==='fulfilled'&&!r.value.error&&Array.isArray(r.value.data)?r.value.data:[]);
 model.activityMediaError=results.some(r=>r.status==='rejected'||r.value.error);
 model.profiles=model.profiles.map(p=>({...p,headshot_url:rows[0].find(row=>row.id===p.id)?.headshot_url||''}));
 model.productions=model.productions.map(p=>({...p,poster_url:rows[1].find(row=>row.id===p.id)?.poster_url||p.poster_url||''}));
 model.casting=rows[2].filter(row=>applicants.includes(row.applicant_id)&&shows.includes(row.production_id));
 const characters=[...new Set(model.casting.map(c=>c.character_id).filter(Boolean))];
 model.characters=[];
 if(characters.length){try{const result=await client.from('bts_visible_characters').select('id,production_id,name').in('id',characters);if(result.error)throw result.error;model.characters=Array.isArray(result.data)?result.data:[];}catch{model.activityMediaError=true;}}
}
export function showInvolvement(model,scope,showId){
 const labels=[];
 for(const person of scope.members){
  const activities=scope.activities.filter(a=>a.profile_id===person.id&&a.production_id===showId&&live(a));
  const roles=[];
  for(const activity of activities){
   const answers=activity.custom_answers||{};
   const confirmed=answers.__bts_cast_offer_status==='accepted'||[true,'true'].includes(answers.__bts_registration_complete);
   const assignments=(model.casting||[]).filter(c=>!c.dropped_out&&c.production_id===showId&&[activity.id,activity.booking_id].filter(Boolean).includes(c.applicant_id)&&(confirmed||c.state==='offer_accepted'));
   const names=assignments.flatMap(c=>(model.characters||[]).filter(role=>role.id===c.character_id&&role.production_id===showId).map(role=>role.name));
   if(names.length)roles.push(...names);else if(answers.__bts_cast_offer_status==='sent')roles.push('Role offered');else if(confirmed)roles.push('Cast');else roles.push(activity.type==='booking'?'Audition booked':'Audition application');
  }
  for(const shift of scope.volunteers.filter(v=>v.profile_id===person.id&&v.production_id===showId&&live(v)))roles.push((shift.role_name||'Volunteer')+(shift.status==='pending'?' (requested)':''));
  for(const role of scope.participations||[])if(role.profile_id===person.id&&role.production_id===showId&&live(role))roles.push(role.role||'Creative Team');
  if(roles.length)labels.push({id:person.id,name:person.name,roles:[...new Set(roles)]});
 }
 return labels;
}
export function renderActivityPicker(model,scope){
 const profiles=model.profiles.filter(p=>p.can_manage&&!p.needs_adult_claim);
 const avatar=(name,fallback)=>`<span class="activity-avatar"><img src="${icon(fallback)}" class="activity-avatar-fallback" alt=""></span><span class="activity-person-name">${esc(name)}</span>`;
 document.getElementById('activity-profile-options').innerHTML=profiles.map(p=>`<button type="button" class="activity-person" data-activity-profile="${esc(p.id)}" aria-pressed="${scope.selected?.kind==='profile'&&scope.selected.id===p.id}">${avatar(p.name,'performer2.svg')}</button>`).join('')||'<a class="member-action" href="/member/profiles/new">Create My Profile</a>';
 document.getElementById('activity-circle-options').innerHTML=(model.circles||[]).map(c=>`<button type="button" class="activity-person" data-activity-circle="${esc(c.id)}" aria-pressed="${scope.selected?.kind==='circle'&&scope.selected.id===c.id}">${avatar(c.name,'my-circle.svg')}</button>`).join('');
 document.getElementById('activity-circle-options').hidden=!(model.circles||[]).length;
 document.getElementById('activity-selection-status').textContent=scope.circle?'Showing '+scope.circle.name+'’s activities.':scope.members.length?'Showing '+scope.members[0].name+'’s activities.':'Choose a profile to view activities.';
 document.getElementById('activity-media-note').hidden=!model.activityMediaError;
 for(const person of profiles){
  const url=imageUrl(person.headshot_url);if(!url)continue;
  const button=[...document.querySelectorAll('[data-activity-profile]')].find(b=>b.dataset.activityProfile===person.id);const frame=button.querySelector('.activity-avatar');
  // Reuse the signed-link helper. A private canonical URL is never loaded as a public image.
  (async()=>{try{mediaPromise||=import('/SHARED/Components/private-profile-media.js?v=20261116-households');await mediaPromise;const source=await window.BTSPrivateMedia.authorisedUrl(url);if(!frame.isConnected)return;const image=new Image();image.alt='';image.className='activity-headshot';image.onload=()=>{if(frame.isConnected)frame.replaceChildren(image);};image.src=source;}catch{/* Keep the existing member icon when a photo is unavailable. */}})();
 }
 syncActivitySidebar(scope);
}
export function syncActivitySidebar(scope){
 const person=scope.members[0];const name=scope.circle?.name||person?.name;if(!name)return;
 document.getElementById('sidebar-profile-name').textContent=name;
 const number=document.getElementById('sidebar-profile-num');if(number)number.textContent='';
 const hint=document.querySelector('.sidebar-profile-switcher-hint');if(hint)hint.textContent=scope.circle?'My Circle':person.is_subject?'My Profile':'Member';
 const switcher=document.getElementById('sidebar-profile-switcher');switcher.href=(location.pathname==='/member/calendar'?'/member/calendar':'/member/activities')+'#activity-scope-picker';switcher.setAttribute('aria-label','Choose a profile or circle');
 const placeholder=document.getElementById('sidebar-avatar-placeholder');if(placeholder){placeholder.hidden=false;placeholder.innerHTML=`<img src="${icon(scope.circle?'my-circle.svg':'performer2.svg')}" alt="" style="width:24px;height:28px;object-fit:contain">`;}
 document.querySelectorAll('.sidebar-profile-avatar').forEach(image=>image.hidden=true);
 if(!scope.circle&&person){sessionStorage.setItem('bts_active_profile_id',person.id);sessionStorage.setItem('bts_active_profile_name',person.name);}
 // Applications currently open a single profile. Circle users choose a member first.
 const applications=document.querySelector('#activity-tools a[href="/member/applications"]');if(applications)applications.hidden=!!scope.circle||!scope.activities.length;
}
export function renderActivityShows(model,scope){
 const grid=document.getElementById('home-productions');
 grid.innerHTML=scope.productions.map(show=>{
  const params=new URLSearchParams({production:show.id});if(scope.selected)params.set(scope.selected.kind,scope.selected.id);
  const captions=[...new Set(showInvolvement(model,scope,show.id).flatMap(row=>row.roles))].map(esc).join(', ');
  const poster=imageUrl(show.poster_url);
  return `<a class="activity-show-card production-card" href="/member/activities?${esc(params)}"><div class="production-card-poster-frame">${poster?`<img src="${esc(poster)}" alt="${esc(show.title)} poster" data-activity-poster>`:''}<img class="activity-poster-placeholder" src="${icon('Placeholder - Poster.svg')}" alt="${poster?'':'Production poster unavailable'}"${poster?' hidden':''}></div><div class="production-card-body"><h3>${esc(show.title)}</h3><p>${captions}</p></div></a>`;
 }).join('')||'<p class="member-note">No productions yet. Productions appear here when this person auditions, joins a production or volunteers.</p>';
 grid.querySelectorAll('[data-activity-poster]').forEach(image=>{image.addEventListener('error',()=>{image.hidden=true;image.nextElementSibling.hidden=false;},{once:true});});
}
