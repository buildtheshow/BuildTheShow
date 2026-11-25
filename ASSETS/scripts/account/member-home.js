// The approved member Home. Records stay tied to explicit profile IDs.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>'/ASSETS/Images/Icons/'+name;
const $=id=>document.getElementById(id);
const localDate=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
const parsed=value=>new Date(String(value).length===10?value+'T12:00:00':value);
const readableDate=value=>parsed(value).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
const active=row=>!['cancelled','canceled','declined','rejected','withdrawn','archived'].includes(row.status);
const selectionKey='bts_member_home_selection';

export function homeScope(model,selection){
 const profiles=(model.profiles||[]).filter(p=>p.can_manage&&!p.needs_adult_claim);
 const own=profiles.find(p=>p.is_subject);
 const circle=(model.circles||[]).find(c=>selection?.kind==='circle'&&c.id===selection.id);
 const person=profiles.find(p=>selection?.kind==='profile'&&p.id===selection.id);
 const selected=circle?{kind:'circle',id:circle.id}:person?{kind:'profile',id:person.id}:own?{kind:'profile',id:own.id}:null;
 const members=circle?profiles.filter(p=>(circle.profiles||[]).includes(p.id)):person?[person]:own?[own]:[];
 const ids=new Set(members.map(p=>p.id));
 const activities=(model.activities||[]).filter(a=>ids.has(a.profile_id));
 const volunteers=(model.volunteers||[]).filter(v=>ids.has(v.profile_id));
 const participations=(model.participations||[]).filter(p=>ids.has(p.profile_id));
 const productionIds=new Set([...activities,...volunteers,...participations].filter(active).map(a=>a.production_id));
 return {selected,circle:circle||null,members,activities,volunteers,participations,productions:(model.productions||[]).filter(p=>productionIds.has(p.id)),events:(model.events||[]).filter(e=>productionIds.has(e.production_id)&&(!e.profile_id||ids.has(e.profile_id)))};
}

export function paymentReminders(invoices,now=new Date()){
 const cutoff=new Date(now.getFullYear(),now.getMonth(),now.getDate()+8);
 const seen=new Set();const reminders=[];
 for(const {profile,invoice} of invoices){
  if(seen.has(invoice.id))continue;seen.add(invoice.id);
  const bill=window.BTSFamilyPayments.summary(invoice);
  // Older shared payments need staff checking before a balance is asserted.
  if(invoice.legacy_payments?.length){reminders.push({profile,invoice,review:true});continue;}
  const due=bill.schedule.find(row=>row.remaining>0&&/^\d{4}-\d{2}-\d{2}$/.test(row.due)&&parsed(row.due)<cutoff);
  if(due)reminders.push({profile,invoice,due,currency:bill.currency});
 }
 return reminders;
}

let model,selection=null,userId='',paymentCache=new Map(),calendarCache=new Map(),generation=0;
let calendarView='week',calendarAnchor=new Date();
let client;
export function updateMemberHome(next,options){
 model=next;client=options.client;
 if(userId!==options.userId){userId=options.userId;selection=null;try{const saved=JSON.parse(sessionStorage.getItem(selectionKey)||'null');if(saved?.user_id===userId)selection=saved.selection;}catch{}}
 paymentCache=new Map();calendarCache=new Map();generation++;renderHome();loadPayments();
}

export function syncMemberHomeSidebar(){
 if(!model)return;const scope=homeScope(model,selection);const person=scope.members[0];
 const name=scope.circle?.name||person?.name;
 if(!name)return;
 $('sidebar-profile-name').textContent=name;
 const number=$('sidebar-profile-num');if(number)number.textContent='';
 const hint=document.querySelector('.sidebar-profile-switcher-hint');if(hint)hint.textContent=scope.circle?'My Circle':person.is_subject?'My Profile':'Member';
 const switcher=$('sidebar-profile-switcher');switcher.href='/member/home#home-spaces';switcher.setAttribute('aria-label','Choose a profile or circle');
 const placeholder=$('sidebar-avatar-placeholder');if(placeholder){placeholder.hidden=false;placeholder.innerHTML=`<img src="${icon(scope.circle?'my-circle.svg':'performer2.svg')}" alt="" style="width:30px;height:32px;object-fit:contain">`;}
 document.querySelectorAll('.sidebar-profile-avatar').forEach(image=>image.hidden=true);
}

function viewUrl(production){
 const params=new URLSearchParams({production});
 if(selection)params.set(selection.kind,selection.id);
 return '/member/activities?'+params;
}
function renderHome(){
 const scope=homeScope(model,selection);selection=scope.selected;sessionStorage.setItem(selectionKey,JSON.stringify({user_id:userId,selection}));
 const circles=model.circles||[];const own=(model.profiles||[]).find(p=>p.is_subject&&p.can_manage);
 $('home-title').textContent='My Home';document.title='My Home | Build The Show';$('home-intro').textContent='See what’s coming up for you and the people you manage.';
 $('home-spaces').hidden=false;$('home-circles-space').hidden=!circles.length;
 $('activity-tools').hidden=true;$('home-profile-section').hidden=true;$('shifts-space').hidden=true;
 $('home-profile-options').innerHTML=(model.profiles||[]).map(p=>{
  const allowed=p.can_manage&&!p.needs_adult_claim;const selected=selection?.kind==='profile'&&selection.id===p.id;
  return `<button type="button" class="home-person-card" data-home-profile="${esc(p.id)}" aria-pressed="${selected}"${allowed?'':' disabled'}><img src="${icon('performer2.svg')}" alt=""><strong>${esc(p.name||'Member')}</strong><span>${p.is_subject?'My Profile':p.needs_adult_claim?'Own adult login needed':allowed?'Member':'Waiting for permission'}</span>${selected?'<small>Selected</small>':''}</button>`;
 }).join('')||'<div class="member-empty"><img class="position-card-icon" src="'+icon('performer2.svg')+'" alt=""><div><strong>Start with My Profile</strong><p class="member-note">Add your own details first. You can manage someone else’s profile too.</p><a class="member-action" href="/member/profiles/new">Create My Profile</a></div></div>';
 $('home-own-profile-note').hidden=!!own||!(model.profiles||[]).length;
 $('home-circle-options').innerHTML=circles.map(c=>{
  const members=(model.profiles||[]).filter(p=>p.can_manage&&!p.needs_adult_claim&&(c.profiles||[]).includes(p.id));const selected=selection?.kind==='circle'&&selection.id===c.id;
  return `<button type="button" class="home-circle-card" data-home-circle="${esc(c.id)}" aria-pressed="${selected}"><img src="${icon('my-circle.svg')}" alt=""><div><strong>${esc(c.name)}</strong><span>${esc(members.map(p=>p.name).join(', ')||'No members shared with you yet')}${members.length?' · '+members.length+' '+(members.length===1?'member':'members'):''}</span></div>${selected?'<small>Selected</small>':''}</button>`;
 }).join('');
 $('home-viewing').textContent=scope.circle?'Showing '+scope.circle.name+'’s dates, productions and updates. Includes the members shared with you.':scope.members.length?'Showing '+(scope.members[0].is_subject?'your':scope.members[0].name+'’s')+' dates, productions and updates.':'Choose a profile or circle to see their dates, productions and updates.';
 $('home-selected-profile-link').hidden=!scope.members.length||!!scope.circle;
 if(scope.members.length)$('home-selected-profile-link').href='/member/profiles/'+encodeURIComponent(scope.members[0].id);
 const actions=[];
 const seenActivities=new Set();
 for(const activity of scope.activities){
  if(!active(activity))continue;const key=activity.booking_id||activity.id;if(seenActivities.has(key))continue;seenActivities.add(key);
  const answers=activity.custom_answers||{};const offer=answers.__bts_cast_offer_code||answers.__bts_cast_offer_token;
  if(offer&&answers.__bts_cast_offer_status==='sent')actions.push({text:activity.name+' has a role offer.',detail:showName(activity.production_id),label:'View offer',url:'/cast-offer?'+new URLSearchParams({prod:activity.production_id,token:offer})});
  if(answers.__bts_cast_offer_status==='accepted'&&![true,'true'].includes(answers.__bts_registration_complete))actions.push({text:'Finish '+activity.name+'’s registration.',detail:showName(activity.production_id),label:'Continue registration',url:'/registration#'+new URLSearchParams({prod:activity.production_id,app:activity.id})});
 }
 for(const person of (model.profiles||[]))if(person.state==='pending'||person.needs_adult_claim)actions.push({text:'Review '+person.name+'’s profile access.',label:'View profile access',url:'/member/circles?profile='+encodeURIComponent(person.id)});
 for(const {profile,invoice,due,currency,review} of paymentReminders(scope.members.flatMap(profile=>(paymentCache.get(profile.id)?.invoices||[]).map(invoice=>({profile,invoice}))))){
  actions.push({text:review?'The production team needs to check older payments.':profile.name+'’s '+(invoice.shared_invoice?'shared payment':'next payment')+' is due '+readableDate(due.due)+'.',detail:invoice.title+(review?'': ' · '+new Intl.NumberFormat('en-CA',{style:'currency',currency}).format(due.remaining/100)),label:'View payment schedule',url:'/member/activities?'+new URLSearchParams({production:invoice.production_id,profile:profile.id})+'#production-payments'});
 }
 $('home-actions-needed').innerHTML=actions.map(a=>`<div class="home-attention-item"><div><p>${esc(a.text)}</p>${a.detail?'<small>'+esc(a.detail)+'</small>':''}</div><a class="cta-btn" href="${esc(a.url)}">${esc(a.label)}</a></div>`).join('');
 const paymentErrors=scope.members.some(p=>paymentCache.get(p.id)?.error);
 $('home-payment-error').hidden=!paymentErrors;$('actions-space').hidden=!actions.length&&!paymentErrors;
 if(paymentErrors){const person=scope.members.find(p=>paymentCache.get(p.id)?.error);$('home-payment-error').innerHTML='Payment reminders could not load. <a href="/member/activities?profile='+encodeURIComponent(person.id)+'">View payment schedules</a>.';}
 const legacy=(model.activities||[]).some(a=>!a.profile_id)||(model.volunteers||[]).some(v=>!v.profile_id);
 $('home-unlinked-note').hidden=!legacy;
 $('home-productions').innerHTML=scope.productions.map(show=>{
  const names=scope.members.filter(p=>[...scope.activities,...scope.volunteers].some(a=>active(a)&&a.production_id===show.id&&a.profile_id===p.id)).map(p=>p.name);
  return `<article class="position-card"><img class="position-card-icon" src="${icon('Performer.svg')}" alt=""><h3 class="position-card-title">${esc(show.title)}</h3><p class="member-note">${esc(names.join(', '))}</p><a class="member-action" href="${esc(viewUrl(show.id))}">View production</a></article>`;
 }).join('')||'<div class="member-empty"><img class="position-card-icon" src="'+icon('Performer.svg')+'" alt=""><div><strong>No productions yet</strong><p class="member-note">Productions appear here when you or someone you manage auditions, registers or volunteers.</p></div></div>';
 renderCalendar(scope);$('home-content').hidden=false;$('home-retry').hidden=true;syncMemberHomeSidebar();
}
function showName(id){return (model.productions||[]).find(p=>p.id===id)?.title||'Production';}
function timeline(scope){
 const names=new Map(scope.members.map(p=>[p.id,p.name]));
 const shifts=scope.volunteers.filter(active).flatMap(v=>[...new Set([v.shift_date,...(Array.isArray(v.required_dates)?v.required_dates:[])])].filter(day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)).map(day=>({id:'shift:'+v.id+':'+day,at:day+'T'+(v.shift_start_time||'00:00:00'),title:'Volunteer shift: '+v.role_name,person:names.get(v.profile_id),production:v.production_id,venue:'',end:v.shift_end_time,unknownTime:!v.shift_start_time,detail:v.status==='pending'?'Request awaiting approval':''})));
 const events=scope.events.map(e=>({id:'event:'+e.id,at:e.start_time,title:e.title,production:e.production_id,venue:e.venue||'',end:e.end_time,unknownTime:e.time_tbd,allDay:e.all_day,person:e.profile_id?names.get(e.profile_id):'',detail:e.profile_id?'':'Production event'}));
 const seen=new Set();
 const auditions=scope.activities.filter(a=>active(a)&&a.start_time).filter(a=>{const key=a.profile_id+':'+a.production_id+':'+(a.slot_id||a.session_id||a.id);if(seen.has(key))return false;seen.add(key);return true;}).map(a=>({id:'audition:'+a.id,at:a.start_time,title:'Audition',person:names.get(a.profile_id),production:a.production_id,venue:a.venue||'',end:a.end_time,unknownTime:a.time_tbd,detail:a.time_tbd?'Time to be arranged':''}));
 return [...events,...shifts,...auditions].filter(e=>Number.isFinite(parsed(e.at).getTime())).sort((a,b)=>parsed(a.at)-parsed(b.at));
}
function renderCalendar(scope){
 const start=new Date(calendarAnchor.getFullYear(),calendarAnchor.getMonth(),calendarAnchor.getDate());
 if(calendarView==='week')start.setDate(start.getDate()-((start.getDay()+6)%7));else start.setDate(1);
 const end=new Date(start);if(calendarView==='week')end.setDate(end.getDate()+7);else end.setMonth(end.getMonth()+1);
 const productionIds=scope.productions.map(p=>p.id).sort();const key=productionIds.join(',')+':'+localDate(start)+':'+localDate(end);const cached=calendarCache.get(key);
 $('home-calendar-error').hidden=!cached?.error;
 const allEvents=timeline({...scope,events:cached?.events||scope.events});const events=allEvents.filter(e=>parsed(e.at)>=start&&parsed(e.at)<end);const dates=new Set(events.map(e=>localDate(parsed(e.at))));
 if(productionIds.length&&!cached){calendarCache.set(key,{loading:true});const current=generation;Promise.resolve().then(()=>client.from('bts_visible_production_events').select('id,production_id,title,event_type,start_time,end_time,venue,all_day,time_tbd').in('production_id',productionIds).gte('start_time',start.toISOString()).lt('start_time',end.toISOString())).then(result=>{if(current!==generation)return;if(result.error)throw result.error;calendarCache.set(key,{events:(Array.isArray(result.data)?result.data:[]).filter(e=>productionIds.includes(e.production_id)&&e.start_time)});renderCalendar(homeScope(model,selection));}).catch(()=>{if(current!==generation)return;calendarCache.set(key,{error:true});renderCalendar(homeScope(model,selection));});}
 $('home-calendar-label').textContent=calendarView==='week'?readableDate(localDate(start))+' – '+readableDate(localDate(new Date(end.getTime()-86400000))):start.toLocaleDateString('en-CA',{month:'long',year:'numeric'});
 document.querySelectorAll('[data-calendar-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.calendarView===calendarView)));
 const today=localDate(new Date());const days=calendarView==='week'?7:new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
 const cells=Array.from({length:days},(_,i)=>{const day=new Date(start);day.setDate(day.getDate()+i);return `<div class="week-day${localDate(day)===today?' today':''}">${calendarView==='week'?'<div class="week-day-name">'+day.toLocaleDateString('en-CA',{weekday:'short'})+'</div>':''}<div class="week-day-num">${day.getDate()}</div><div class="${dates.has(localDate(day))?'week-day-dot':'week-day-dot-placeholder'}"></div></div>`;}).join('');
 $('home-week').hidden=calendarView!=='week';$('home-month').hidden=calendarView!=='month';
 if(calendarView==='week')$('home-week').innerHTML=cells;else $('home-month').innerHTML=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<div class="home-month-label">'+d+'</div>').join('')+'<div aria-hidden="true"></div>'.repeat((start.getDay()+6)%7)+cells;
 $('home-upcoming').innerHTML=events.map(e=>{
  const day=parsed(e.at);const time=e.allDay?'All day':e.unknownTime?'Time to be arranged':day.toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'});let end='';if(e.end&&!e.allDay){const finish=/^\d{2}:/.test(e.end)?parsed(localDate(day)+'T'+e.end):parsed(e.end);if(Number.isFinite(finish.getTime()))end='–'+finish.toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'});}
  return `<div class="upcoming-item"><div class="upcoming-date-badge"><div class="upcoming-date-mon">${esc(day.toLocaleDateString('en-CA',{month:'short'}))}</div><div class="upcoming-date-day">${day.getDate()}</div></div><div><a class="upcoming-event-title" href="${esc(viewUrl(e.production))}">${esc((scope.circle&&e.person?e.person+' · ':'')+e.title)}</a><p class="upcoming-event-sub">${esc(showName(e.production))}<br>${esc(time+(e.unknownTime||e.allDay?'':end)+(e.venue?' · '+e.venue:''))}${e.detail?'<br>'+esc(e.detail):''}</p></div></div>`;
 }).join('')||'<p class="upcoming-empty">Nothing coming up '+(calendarView==='week'?'this week':'this month')+'. Auditions, rehearsals and volunteer dates will appear here.</p>';
}
async function loadPayments(){
 const current=generation;const scope=homeScope(model,selection);const missing=scope.members.filter(p=>!paymentCache.has(p.id));
 for(const person of missing)paymentCache.set(person.id,{loading:true});
 await Promise.allSettled(missing.map(async person=>{try{const result=await client.rpc('bts_family_tracker',{p_profile_id:person.id});if(current!==generation)return;if(result.error)throw result.error;paymentCache.set(person.id,{invoices:Array.isArray(result.data)?result.data:[]});}catch{if(current===generation)paymentCache.set(person.id,{error:true});}}));
 if(current===generation&&missing.length)renderHome();
}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||!model)return;
 if(button.dataset.homeProfile||button.dataset.homeCircle){selection={kind:button.dataset.homeCircle?'circle':'profile',id:button.dataset.homeCircle||button.dataset.homeProfile};selection=homeScope(model,selection).selected;sessionStorage.setItem(selectionKey,JSON.stringify({user_id:userId,selection}));renderHome();loadPayments();}
 if(button.dataset.calendarView){calendarView=button.dataset.calendarView;renderCalendar(homeScope(model,selection));}
 if(button.dataset.calendarMove){if(button.dataset.calendarMove==='today')calendarAnchor=new Date();else if(calendarView==='week')calendarAnchor.setDate(calendarAnchor.getDate()+7*Number(button.dataset.calendarMove));else calendarAnchor=new Date(calendarAnchor.getFullYear(),calendarAnchor.getMonth()+Number(button.dataset.calendarMove),1);renderCalendar(homeScope(model,selection));}
});
