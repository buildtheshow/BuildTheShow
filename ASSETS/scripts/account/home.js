import {supabase as client} from '/ASSETS/scripts/supabase.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const production=params.get('production')||params.get('id')||'';
const mode=['/member/activities','/member/activities'].includes(location.pathname)?'activities':'home';
if(params.get('open')==='manage')location.replace('/org');
const tokenKey='bts_production_invitation';
window.addEventListener('hashchange',()=>{const next=new URLSearchParams(location.hash.slice(1));if(next.has('team-invite')||next.has('volunteer-claim'))location.reload();});
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.get('volunteer-claim')){sessionStorage.setItem('bts_volunteer_claim',fragment.get('volunteer-claim'));history.replaceState(null,'',location.pathname+location.search);}
if(fragment.get('team-invite')){sessionStorage.setItem(tokenKey,fragment.get('team-invite'));history.replaceState(null,'',location.pathname+location.search);}
let state;let loading=false;
function status(text){$('home-status').textContent=text;$('home-status').hidden=false;}
async function call(name,args={}){const result=await client.rpc(name,args);if(result.error)throw result.error;return result.data;}
async function work(action,button){if(button)button.disabled=true;try{await action();}catch(error){status(error.code==='P0001'?error.message:'We could not load this account activity. Please try again.');}finally{if(button)button.disabled=false;}}
const date=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'Date to be arranged';
const showTitle=id=>state.productions.find(p=>p.id===id)?.title||'Production';
function activityUrl(id){return '/member/activities?production='+encodeURIComponent(id);}
function render(){
 const selectedHistory=$('history-profile').value;
 $('history-profile').innerHTML='<option value="">Choose the correct profile</option>'+state.profiles.filter(p=>p.can_volunteer).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');$('history-profile').value=selectedHistory;
 const own=state.profiles.find(p=>p.is_subject&&p.can_manage);const circles=state.circles||[];
 const profileLink=$('my-profile-shortcut');profileLink.href=own?'/member/profiles/'+encodeURIComponent(own.id):'/member/profiles/new';
 $('home-profile-copy').textContent=own?'Your details and activities.':'Start with your own details and activities.';
 $('home-profile-cta').textContent=own?'View my profile →':'Create My Profile →';
 $('home-circle-title').textContent=circles.length?'My Circle':'Create or join a circle';
 $('home-circle-copy').textContent=circles.length?circles.map(c=>c.name).join(', '):'Managing more than yourself? Keep members together and choose who can help.';
 $('home-circle-open').hidden=!circles.length;$('home-circle-start').hidden=!!circles.length;
 $('home-title').textContent=mode==='activities'?'My Activities':'My Home';document.title=$('home-title').textContent+' | Build The Show';
 $('home-spaces').hidden=mode!=='home';

 $('shifts-space').hidden=mode!=='activities';$('activity-tools').hidden=mode!=='activities';
 const actions=[];
 for(const activity of state.activities){const answers=activity.custom_answers||{};const offer=answers.__bts_cast_offer_code||answers.__bts_cast_offer_token;
  if(offer&&answers.__bts_cast_offer_status==='sent')actions.push({label:activity.name+': review role offer',url:'/cast-offer?'+new URLSearchParams({prod:activity.production_id,token:offer})});
  if(answers.__bts_cast_offer_status==='accepted'&&answers.__bts_registration_complete!==true&&answers.__bts_registration_complete!=='true')actions.push({label:activity.name+': complete registration',url:'/registration#'+new URLSearchParams({prod:activity.production_id,app:activity.id})});
 }
 for(const person of state.profiles)if(person.state==='pending'||person.needs_adult_claim)actions.push({label:person.name+': review profile access',url:'/member/circles?profile='+encodeURIComponent(person.id)});
 $('actions-space').hidden=actions.length===0;
 $('home-actions-needed').innerHTML=actions.map(action=>`<div class="member-record"><a href="${esc(action.url)}">${esc(action.label)}</a></div>`).join('')||'<p>No pending offer, registration or profile-access action is recorded.</p>';
 $('home-intro').textContent=mode==='activities'?'Auditions, rehearsals and volunteer shifts, all in one place.':circles.length?'Your circle, your shows and what’s coming up.':'Your profile, your shows and what’s coming up.';
 $('home-profiles').innerHTML=state.profiles.filter(p=>p.is_subject).map(p=>`<article class="position-card"><div class="profile-heading"><img class="position-card-icon" src="/ASSETS/Images/Icons/performer2.svg" alt=""><h3 class="position-card-title">${esc(p.name)}</h3></div>${p.needs_adult_claim?'<p class="member-note profile-card-copy">This adult needs to confirm their own access.</p>':!p.can_manage?'<p class="member-note profile-card-copy">Waiting for permission to manage this profile.</p>':''}<div class="member-actions">${p.can_manage?`<a href="/member/profiles/${encodeURIComponent(p.id)}">View profile →</a>`:''}<a href="/member/circles?profile=${encodeURIComponent(p.id)}">Access and payments →</a></div></article>`).join('')||'<div class="member-empty"><img class="position-card-icon" src="/ASSETS/Images/Icons/performer2.svg" alt=""><div><strong>Start with My Profile</strong><p class="member-note">Add your own details to get started. Use My Circle to manage other members.</p></div></div>';
 $('home-productions').innerHTML=state.productions.map(p=>`<article class="position-card"><img class="position-card-icon" src="/ASSETS/Images/Icons/Performer.svg" alt=""><h3 class="position-card-title">${esc(p.title)}</h3><div class="member-actions"><a href="${activityUrl(p.id)}">View activities →</a><a href="/volunteer?id=${encodeURIComponent(p.id)}">Volunteer for this show →</a><a href="/member/applications?production=${encodeURIComponent(p.id)}">Auditions and registrations →</a></div></article>`).join('')||'<div class="member-empty"><img class="position-card-icon" src="/ASSETS/Images/Icons/Performer.svg" alt=""><div><strong>No shows yet</strong><p class="member-note">Your shows appear here when you audition, register or request a volunteer shift.</p></div></div>';
 const today=new Date();const monday=new Date(today);monday.setDate(today.getDate()-(today.getDay()===0?6:today.getDay()-1));
 const eventDates=new Set(state.events.map(e=>String(e.start_time||'').slice(0,10)));
 $('home-week').innerHTML=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((name,i)=>{const day=new Date(monday);day.setDate(monday.getDate()+i);const current=day.toDateString()===today.toDateString();const stamp=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');return `<div class="week-day${current?' today':''}"><div class="week-day-name">${name}</div><div class="week-day-num">${day.getDate()}</div><div class="${eventDates.has(stamp)?'week-day-dot':'week-day-dot-placeholder'}"></div></div>`;}).join('');
 const shifts=state.volunteers.filter(v=>v.status!=='cancelled');
 const upcoming=[...state.events.map(e=>({at:e.start_time,title:e.title,production:e.production_id,detail:e.venue||''})),...shifts.filter(v=>v.shift_date).map(v=>({at:v.shift_date+'T'+(v.shift_start_time||'12:00:00'),title:v.name+': '+v.role_name,production:v.production_id,detail:v.status==='pending'?'Volunteer request awaiting approval':'Volunteer shift'}))].filter(e=>new Date(e.at)>=new Date(Date.now()-86400000)).sort((a,b)=>a.at.localeCompare(b.at)).slice(0,12);
 $('home-upcoming').innerHTML=upcoming.slice(0,5).map(e=>{const day=new Date(e.at);return `<div class="upcoming-item"><div class="upcoming-date-badge"><div class="upcoming-date-mon">${esc(day.toLocaleDateString('en-CA',{month:'short'}))}</div><div class="upcoming-date-day">${day.getDate()}</div></div><div><div class="upcoming-event-title">${esc(e.title)}</div><div class="upcoming-event-sub">${esc(showTitle(e.production))} · ${esc(e.detail)}</div></div></div>`;}).join('')||'<p class="upcoming-empty">Nothing coming up yet. Auditions, rehearsals and shifts will appear here.</p>';
 $('home-shifts').innerHTML=state.volunteers.map(v=>`<article class="member-record"><strong>${esc(v.name)}: ${esc(v.role_name)}</strong><p>${esc(v.title)} · ${esc(date(v.shift_date))}${v.shift_start_time?' · '+esc(v.shift_start_time.slice(0,5))+(v.shift_end_time?' to '+esc(v.shift_end_time.slice(0,5)):''):''}</p><p>Status: ${esc(v.status.replaceAll('_',' '))}. ${v.approved_hours==null?'Hours not yet confirmed.':'Confirmed hours: '+esc(v.approved_hours)+'.'}</p>${v.status!=='cancelled'?`<button class="member-action" data-cancel-shift="${esc(v.id)}">Cancel this request or shift</button>`:''}</article>`).join('')||'<p>No volunteer shifts yet. Browse volunteer opportunities to get started.</p>';
 $('home-legacy-volunteers').innerHTML=state.volunteers.filter(v=>!v.profile_id).map(v=>`<div class="member-record"><p>${esc(v.name)} · ${esc(v.role_name)}</p><label>Connect this older record to the correct person<select id="legacy-person-${esc(v.id)}">${state.profiles.filter(p=>p.can_volunteer).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><button data-link-volunteer="${esc(v.id)}">Confirm profile connection</button></div>`).join('')||'<p>No older unlinked volunteer records owned by this login.</p>';
 $('home-content').hidden=false;$('home-retry').hidden=true;
 if(params.get('tab')==='shifts')$('shifts-space').scrollIntoView();
 if(params.get('tab')==='calendar')$('upcoming-space').scrollIntoView();
}
async function load(){if(loading)return;loading=true;try{const [home,circle]=await Promise.all([call('bts_my_home',{p_production_id:production||null}),call('bts_circle',{p_action:'snapshot',p_data:{}})]);state={...home,circles:circle.circles||circle.households||[],profiles:circle.profiles||home.profiles};render();if($('home-status').textContent==='Loading your shows and profiles…')$('home-status').hidden=true;if(typeof loadMemberSidebarProfile==='function')loadMemberSidebarProfile(client,state.profiles,{circles:state.circles}).catch(()=>{});}finally{loading=false;}}
$('request-volunteer-history').onclick=event=>work(async()=>{const result=await call('bts_request_volunteer_history',{p_production_id:production||null});status(result.message);},event.target);
$('home-logout').onclick=()=>work(async()=>{await client.auth.signOut();sessionStorage.clear();location.replace('/login');});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;
 if(button.dataset.cancelShift)work(async()=>{if(!confirm('Cancel this volunteer request or shift?'))return;const result=await client.from('bts_participant_volunteers').update({status:'cancelled'}).eq('id',button.dataset.cancelShift);if(result.error)throw result.error;await load();status('Volunteer request cancelled.');},button);
 if(button.dataset.linkVolunteer)work(async()=>{const id=button.dataset.linkVolunteer;const profile=$('legacy-person-'+id).value;if(!profile||!confirm('I confirm this older volunteer record belongs to the selected person.'))return;await call('bts_link_my_volunteer',{p_signup_id:id,p_profile_id:profile});await load();status('Older volunteer record connected.');},button);
});
await work(async()=>{
 const historyToken=sessionStorage.getItem('bts_volunteer_claim');
 if(historyToken){let record;try{record=await call('bts_confirm_volunteer_history',{p_token:historyToken,p_profile_id:null,p_accept:false});}catch(error){sessionStorage.removeItem('bts_volunteer_claim');throw error;}$('history-confirmation').hidden=false;$('history-copy').textContent=record.person+' · '+record.production+' · '+record.count+' older record(s). Record reference: '+record.record_reference+'. Use '+record.email+'.';$('history-accept').onclick=event=>work(async()=>{if(!await BTSAccountSecurity.requireAdultLogin(client,'/member/home'))return;if(!$('history-confirmed').checked)throw {code:'P0001',message:'Confirm the selected person and your authority.'};await call('bts_confirm_volunteer_history',{p_token:historyToken,p_profile_id:$('history-profile').value||null,p_accept:true});sessionStorage.removeItem('bts_volunteer_claim');$('history-confirmation').hidden=true;status('Historical volunteer records connected.');await load();},event.target);}
 const token=sessionStorage.getItem(tokenKey);
 if(token){try{const invitation=await call('bts_production_invitation',{p_token:token,p_accept:false});$('membership-invitation').hidden=false;$('membership-copy').textContent=invitation.production+': '+invitation.position+'. Accept using '+invitation.email+'.';$('membership-accept').onclick=event=>work(async()=>{if(!await BTSAccountSecurity.requireAdultLogin(client,'/member/home'))return;await call('bts_production_invitation',{p_token:token,p_accept:true});sessionStorage.removeItem(tokenKey);$('membership-invitation').hidden=true;status('Production membership accepted.');await load();},event.target);}catch(error){sessionStorage.removeItem(tokenKey);throw error;}}
 if(typeof renderMemberSidebar==='function')renderMemberSidebar(mode==='home'?'profile-select':mode);
 const {data}=await client.auth.getUser();if(!data?.user&&(token||historyToken)){if(historyToken){$('history-accept').textContent='Sign in to confirm';$('history-accept').onclick=()=>BTSAccountSecurity.requireAdultLogin(client,'/member/home');}return;}if(!await BTSAccountSecurity.requireAdultLogin(client))return;$('home-logout').hidden=false;$('sidebar-email').textContent=data.user.email||'';await load();if(historyToken)$('history-profile').innerHTML='<option value="">Choose the correct profile</option>'+state.profiles.filter(p=>p.can_volunteer).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
});
setInterval(()=>{if(document.visibilityState==='visible'&&state)work(load);},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state)work(load);});
