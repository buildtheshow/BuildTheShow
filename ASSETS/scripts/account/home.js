import {ensureOwnProfile} from './basic-profile.js?v=20261125-basic-profile';
import {mountMemberProduction} from './member-production.js?v=20261125-member-completion';
import {mountProductionPayments} from './member-payments.js?v=20261121-production-payments';
import {supabase as client} from '/ASSETS/scripts/supabase.js';
import {updateMemberHome,syncMemberHomeSidebar,homeScope} from './member-home.js?v=20261125-basic-profile';
import {enrichActivityMedia,renderActivityPicker,renderActivityShows,syncActivitySidebar} from './member-activities.js?v=20261125-my-circle-icon';
const $=id=>document.getElementById(id);
const productionView=mountMemberProduction(client,$('production-details'));
const paymentView=mountProductionPayments(client,$('production-payments'));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const production=params.get('production')||params.get('id')||'';
const mode=location.pathname==='/member/calendar'?'calendar':location.pathname==='/member/activities'?'activities':'home';
if(params.get('open')==='manage')location.replace('/org');
const tokenKey='bts_production_invitation';
window.addEventListener('hashchange',()=>{const next=new URLSearchParams(location.hash.slice(1));if(next.has('team-invite')||next.has('volunteer-claim'))location.reload();});
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.get('volunteer-claim')){sessionStorage.setItem('bts_volunteer_claim',fragment.get('volunteer-claim'));history.replaceState(null,'',location.pathname+location.search);}
if(fragment.get('team-invite')){sessionStorage.setItem(tokenKey,fragment.get('team-invite'));history.replaceState(null,'',location.pathname+location.search);}
let state,allState,activitySelection=null;let activitySelectionReady=false;let loading=false;let signedInUserId='';
function setPageView(){
 const calendar=mode==='calendar';
 if($('production-payments'))$('production-payments').hidden=calendar||!$('production-payments').children.length;
 $('upcoming-space').hidden=!calendar;
 $('activities-space').hidden=calendar;
 $('shifts-space').hidden=mode!=='activities'||params.get('tab')!=='shifts';
 $('actions-space').hidden=calendar||$('home-actions-needed').querySelectorAll('a').length===0;
 $('home-calendar-title').textContent='Calendar';
 $('upcoming-space').querySelector('.week-strip-link').hidden=calendar;
}
function status(text){$('home-status').textContent=text;$('home-status').hidden=false;}
async function call(name,args={}){const result=await client.rpc(name,args);if(result.error)throw result.error;return result.data;}
async function work(action,button){if(button)button.disabled=true;try{await action();}catch(error){status(error.code==='P0001'?error.message:'We could not load this account activity. Please try again.');}finally{if(button)button.disabled=false;}}
const date=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'Date to be arranged';
const showTitle=id=>state.productions.find(p=>p.id===id)?.title||'Production';
function render(){
 let activityScope;if(mode!=='home'){activityScope=homeScope(allState,activitySelection);activitySelection=activityScope.selected;state={...allState,...activityScope,profiles:allState.profiles};document.body.classList.add('member-activities');$('activity-scope-picker').hidden=false;renderActivityPicker(allState,activityScope);}
 const selectedHistory=$('history-profile').value;
 $('history-profile').innerHTML='<option value="">Choose the correct profile</option>'+state.profiles.filter(p=>p.can_volunteer).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');$('history-profile').value=selectedHistory;
 if(mode==='home'){document.body.classList.add('member-home');updateMemberHome(state,{client,userId:signedInUserId});return;}
 $('home-circles-space').hidden=true;document.querySelector('.home-view-summary').hidden=true;$('home-calendar-views').hidden=true;$('home-calendar-period').hidden=true;$('home-calendar-source-note').hidden=true;$('home-unlinked-note').hidden=true;
 $('home-title').textContent=mode==='calendar'?'My Calendar':'My Activities';document.title=$('home-title').textContent+' | Build The Show';
 $('home-spaces').hidden=mode!=='home';

 $('shifts-space').hidden=!production&&params.get('tab')!=='shifts';$('activity-tools').hidden=!production&&params.get('tab')!=='shifts';
 const actions=[];
 for(const activity of state.activities){const answers=activity.custom_answers||{};const offer=answers.__bts_cast_offer_code||answers.__bts_cast_offer_token;
  if(offer&&answers.__bts_cast_offer_status==='sent')actions.push({label:activity.name+': review role offer',url:'/cast-offer?'+new URLSearchParams({prod:activity.production_id,token:offer})});
  if(answers.__bts_cast_offer_status==='accepted'&&answers.__bts_registration_complete!==true&&answers.__bts_registration_complete!=='true')actions.push({label:activity.name+': complete registration',url:'/registration#'+new URLSearchParams({prod:activity.production_id,app:activity.id})});
 }
 for(const person of state.profiles)if(person.state==='pending'||person.needs_adult_claim)actions.push({label:person.name+': review profile access',url:'/member/circles?profile='+encodeURIComponent(person.id)});
 $('actions-space').hidden=actions.length===0;
 $('home-actions-needed').innerHTML=actions.map(action=>`<div class="member-record"><a href="${esc(action.url)}">${esc(action.label)}</a></div>`).join('')||'<p>No pending offer, registration or profile-access action is recorded.</p>';
 $('home-intro').textContent=mode==='calendar'?'Auditions, rehearsals and volunteer dates for the selected profile or circle.':'Auditions, rehearsals and volunteer work for you and the people you manage.';
 $('home-profile-section').hidden=true;renderActivityShows(allState,{...activityScope,productions:production?activityScope.productions.filter(p=>p.id===production):activityScope.productions});
 const creative=(activityScope.participations||[]).some(p=>!production||p.production_id===production);for(const a of $('activity-tools').querySelectorAll('a[href^="/member/creative/"]'))a.hidden=!creative;const shiftLink=$('activity-tools').querySelector('a[href*="tab=shifts"]');if(shiftLink)shiftLink.hidden=!activityScope.volunteers.length;$('activity-tools').hidden=!production&&params.get('tab')!=='shifts'||![...$('activity-tools').querySelectorAll('a')].some(a=>!a.hidden);
 $('home-productions').hidden=!!production;const productionHeading=$('activity-production-heading');if(productionHeading)productionHeading.hidden=!!production;document.querySelector('.welcome-block').hidden=mode==='activities'&&!!production;
 if(production&&mode==='activities')productionView.refresh({model:allState,scope:activityScope,production});else productionView.clear();
 if(production&&mode==='activities')paymentView.refresh({production,members:activityScope.members});else paymentView.clear();
 if(production){const back=$('activity-back-link'),link=document.createElement('a'),query=new URLSearchParams();if(activityScope.selected)query.set(activityScope.selected.kind,activityScope.selected.id);link.href='/member/activities'+(query.size?'?'+query:'');link.textContent='← All productions';back.replaceChildren(link);back.hidden=false;}
 const today=new Date();const monday=new Date(today);monday.setDate(today.getDate()-(today.getDay()===0?6:today.getDay()-1));
 const eventDates=new Set(state.events.map(e=>String(e.start_time||'').slice(0,10)));
 $('home-week').innerHTML=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((name,i)=>{const day=new Date(monday);day.setDate(monday.getDate()+i);const current=day.toDateString()===today.toDateString();const stamp=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');return `<div class="week-day${current?' today':''}"><div class="week-day-name">${name}</div><div class="week-day-num">${day.getDate()}</div><div class="${eventDates.has(stamp)?'week-day-dot':'week-day-dot-placeholder'}"></div></div>`;}).join('');
 const shifts=state.volunteers.filter(v=>v.status!=='cancelled');
 const upcoming=[...state.events.map(e=>({at:e.start_time,title:e.title,production:e.production_id,detail:e.venue||''})),...shifts.filter(v=>v.shift_date).map(v=>({at:v.shift_date+'T'+(v.shift_start_time||'12:00:00'),title:v.name+': '+v.role_name,production:v.production_id,detail:v.status==='pending'?'Volunteer request awaiting approval':'Volunteer shift'}))].filter(e=>new Date(e.at)>=new Date(Date.now()-86400000)).sort((a,b)=>a.at.localeCompare(b.at));
 $('home-upcoming').innerHTML=(mode==='calendar'?upcoming:upcoming.slice(0,5)).map(e=>{const day=new Date(e.at);return `<div class="upcoming-item"><div class="upcoming-date-badge"><div class="upcoming-date-mon">${esc(day.toLocaleDateString('en-CA',{month:'short'}))}</div><div class="upcoming-date-day">${day.getDate()}</div></div><div><div class="upcoming-event-title">${esc(e.title)}</div><div class="upcoming-event-sub">${esc(showTitle(e.production))} · ${esc(e.detail)}</div></div></div>`;}).join('')||'<p class="upcoming-empty">Nothing coming up yet. Auditions, rehearsals and volunteer dates will appear here.</p>';
 $('home-shifts').innerHTML=state.volunteers.map(v=>`<article class="member-record"><strong>${esc(v.name)}: ${esc(v.role_name)}</strong><p>${esc(v.title)} · ${esc(date(v.shift_date))}${v.shift_start_time?' · '+esc(v.shift_end_time?BTSFormatTimeRange(v.shift_start_time,v.shift_end_time):BTSFormatTime(v.shift_start_time)):''}</p><p>Status: ${esc(v.status.replaceAll('_',' '))}. ${v.approved_hours==null?'Hours not yet confirmed.':'Confirmed hours: '+esc(v.approved_hours)+'.'}</p>${v.status!=='cancelled'?`<button class="member-action" data-cancel-shift="${esc(v.id)}">Cancel this request or shift</button>`:''}</article>`).join('')||'<p>No volunteer shifts yet. Browse volunteer opportunities to get started.</p>';
 $('home-legacy-volunteers').innerHTML=state.volunteers.filter(v=>!v.profile_id).map(v=>`<div class="member-record"><p>${esc(v.name)} · ${esc(v.role_name)}</p><label>Connect this older record to the correct person<select id="legacy-person-${esc(v.id)}">${state.profiles.filter(p=>p.can_volunteer).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><button data-link-volunteer="${esc(v.id)}">Confirm profile connection</button></div>`).join('')||'<p>No older unlinked volunteer records owned by this login.</p>';
 $('home-content').hidden=false;$('home-retry').hidden=true;
 if(params.get('tab')==='shifts'&&mode==='activities')$('shifts-space').scrollIntoView();
 setPageView();
}
async function enrichAuditions(home){
 const activities=home.activities||[];const slots=[...new Set(activities.map(a=>a.slot_id).filter(Boolean))];const sessions=[...new Set(activities.map(a=>a.session_id).filter(Boolean))];if(!slots.length&&!sessions.length)return;
 const queries=[slots.length?client.from('bts_visible_audition_time_slots').select('id,session_id,slot_time,slot_date').in('id',slots):Promise.resolve({data:[]}),slots.length?client.from('bts_visible_audition_slots').select('id,production_id,date,start_time,end_time').in('id',slots):Promise.resolve({data:[]}),sessions.length?client.from('bts_visible_audition_sessions').select('id,production_id,date,end_date,start_time,end_time,location,booking_mode').in('id',sessions):Promise.resolve({data:[]})];
 const results=await Promise.allSettled(queries);const rows=results.map(r=>r.status==='fulfilled'&&!r.value.error&&Array.isArray(r.value.data)?r.value.data:[]);
 for(const activity of activities){const session=rows[2].find(s=>s.id===activity.session_id&&s.production_id===activity.production_id);const timed=rows[0].find(t=>t.id===activity.slot_id&&t.session_id===activity.session_id);const legacy=rows[1].find(t=>t.id===activity.slot_id&&t.production_id===activity.production_id);const singleDay=session&&(!session.end_date||session.end_date===session.date)?session.date:null;const day=timed?(timed.slot_date||singleDay):legacy?.date||(session?.booking_mode==='group'?singleDay:null);const time=timed?.slot_time||legacy?.start_time||(session?.booking_mode==='group'?session.start_time:null);if(day){activity.start_time=day+'T'+(time||'00:00:00');activity.time_tbd=!time;activity.venue=session?.location||'';activity.end_time=legacy?.end_time||null;}}
}
async function load(){if(loading)return;loading=true;try{const [home,circle]=await Promise.all([call('bts_my_home',{p_production_id:production||null}),call('bts_circle',{p_action:'snapshot',p_data:{}})]);state={...home,circles:circle.circles||circle.households||[],profiles:circle.profiles||home.profiles};await enrichAuditions(state);if(mode!=='home')await enrichActivityMedia(client,state);allState=state;const authorisedProfiles=state.profiles;if(mode!=='home'&&!activitySelectionReady){let viewSelection=null;try{const saved=JSON.parse(sessionStorage.getItem('bts_member_home_selection')||'null');if(saved?.user_id===signedInUserId)viewSelection=saved.selection;}catch{}if(params.has('profile')||params.has('circle'))viewSelection={kind:params.has('circle')?'circle':'profile',id:params.get('circle')||params.get('profile')};activitySelection=homeScope(state,viewSelection).selected;if(!activitySelection){const first=state.profiles.find(p=>p.can_manage&&!p.needs_adult_claim);if(first)activitySelection={kind:'profile',id:first.id};}activitySelectionReady=true;}render();if($('home-status').textContent==='Loading your productions and profiles…')$('home-status').hidden=true;if(typeof loadMemberSidebarProfile==='function')loadMemberSidebarProfile(client,authorisedProfiles,{circles:state.circles}).then(()=>{if(mode==='home')syncMemberHomeSidebar();else syncActivitySidebar(homeScope(allState,activitySelection));}).catch(()=>{});}finally{loading=false;}}
$('request-volunteer-history').onclick=event=>work(async()=>{const result=await call('bts_request_volunteer_history',{p_production_id:production||null});status(result.message);},event.target);
$('home-logout').onclick=()=>work(async()=>{await client.auth.signOut();sessionStorage.clear();location.replace('/login');});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;
 if(button.dataset.activityProfile||button.dataset.activityCircle){const requested={kind:button.dataset.activityCircle?'circle':'profile',id:button.dataset.activityCircle||button.dataset.activityProfile};const scope=homeScope(allState,requested);if(scope.selected?.id!==requested.id||scope.selected?.kind!==requested.kind)return;activitySelection=scope.selected;sessionStorage.setItem('bts_member_home_selection',JSON.stringify({user_id:signedInUserId,selection:activitySelection}));const url=new URL(location.href);url.searchParams.delete('profile');url.searchParams.delete('circle');url.searchParams.set(activitySelection.kind,activitySelection.id);history.replaceState(null,'',url.pathname+url.search);render();}
 if(button.dataset.cancelShift)work(async()=>{if(!confirm('Cancel this volunteer request or shift?'))return;const result=await client.from('bts_participant_volunteers').update({status:'cancelled'}).eq('id',button.dataset.cancelShift);if(result.error)throw result.error;await load();status('Volunteer request cancelled.');},button);
 if(button.dataset.linkVolunteer)work(async()=>{const id=button.dataset.linkVolunteer;const profile=$('legacy-person-'+id).value;if(!profile||!confirm('I confirm this older volunteer record belongs to the selected person.'))return;await call('bts_link_my_volunteer',{p_signup_id:id,p_profile_id:profile});await load();status('Older volunteer record connected.');},button);
});
await work(async()=>{
 const historyToken=sessionStorage.getItem('bts_volunteer_claim');
 if(historyToken){let record;try{record=await call('bts_confirm_volunteer_history',{p_token:historyToken,p_profile_id:null,p_accept:false});}catch(error){sessionStorage.removeItem('bts_volunteer_claim');throw error;}$('history-confirmation').hidden=false;$('history-copy').textContent=record.person+' · '+record.production+' · '+record.count+' older record(s). Record reference: '+record.record_reference+'. Use '+record.email+'.';$('history-accept').onclick=event=>work(async()=>{if(!await BTSAccountSecurity.requireAdultLogin(client,'/member/home'))return;if(!$('history-confirmed').checked)throw {code:'P0001',message:'Confirm the selected person and your authority.'};await call('bts_confirm_volunteer_history',{p_token:historyToken,p_profile_id:$('history-profile').value||null,p_accept:true});sessionStorage.removeItem('bts_volunteer_claim');$('history-confirmation').hidden=true;status('Historical volunteer records connected.');await load();},event.target);}
 const token=sessionStorage.getItem(tokenKey);
 if(token){try{const invitation=await call('bts_production_invitation',{p_token:token,p_accept:false});$('membership-invitation').hidden=false;$('membership-copy').textContent=invitation.production+': '+invitation.position+'. Accept using '+invitation.email+'.';$('membership-accept').onclick=event=>work(async()=>{if(!await BTSAccountSecurity.requireAdultLogin(client,'/member/home'))return;await call('bts_production_invitation',{p_token:token,p_accept:true});sessionStorage.removeItem(tokenKey);$('membership-invitation').hidden=true;status('Production membership accepted.');await load();},event.target);}catch(error){sessionStorage.removeItem(tokenKey);throw error;}}
 if(typeof renderMemberSidebar==='function')renderMemberSidebar(mode==='home'?'profile-select':mode);
 const {data}=await client.auth.getUser();if(!data?.user&&(token||historyToken)){if(historyToken){$('history-accept').textContent='Sign in to confirm';$('history-accept').onclick=()=>BTSAccountSecurity.requireAdultLogin(client,'/member/home');}return;}if(!await BTSAccountSecurity.requireAdultLogin(client))return;await ensureOwnProfile(client);signedInUserId=data.user.id;$('home-logout').hidden=false;$('sidebar-email').textContent=data.user.email||'';await load();if(historyToken)$('history-profile').innerHTML='<option value="">Choose the correct profile</option>'+state.profiles.filter(p=>p.can_volunteer).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
});
setInterval(()=>{if(document.visibilityState==='visible'&&state)work(load);},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state)work(load);});
