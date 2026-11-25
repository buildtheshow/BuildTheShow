/* The booking form chooses a canonical performer; the database checks the actual key. */
(function () {
  'use strict';
  let clientPromise;let mountPromise;let mounted=false;let profiles=[];let reviewed=null;let reviewBusy=false;
  function rememberReview(id,data){const saved=data.custom_answers?.__bts_profile_submission||{};const custom={__bts_profile_submission:saved};if(saved.bio)custom.Bio=saved.bio;reviewed={id,data:{profile_id:id,...(saved.headshot_url?{headshot_url:saved.headshot_url}:{}),...(saved.resume_url?{file_url:saved.resume_url}:{}),...(saved.experience?{experience:saved.experience}:{}),custom_answers:custom}};}
  const client = () => clientPromise ||= import('/ASSETS/scripts/supabase.js').then(m=>m.supabase);
  const field = (id,value) => { const input=document.getElementById(id);if(input){input.value=value||'';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));} };
  function mount() {
    if (mountPromise) return mountPromise;
    mountPromise = mountPicker().finally(() => { mountPromise = null; });
    return mountPromise;
  }
  async function mountPicker() {
    const host=document.getElementById('bk-panel-1')||document.getElementById('st-panel-1')||document.getElementById('app-name')?.closest('.aud-card');
    if(!host||host.querySelector('[data-household-picker]')||mounted)return;
    mounted=true;
    try {
      const sb=await client();const {data:user}=await sb.auth.getUser();if(!user?.user){mounted=false;return;}
      const [{data:state,error},{data:people}]=await Promise.all([sb.rpc('bts_family',{p_action:'snapshot',p_data:{}}),sb.from('profiles').select('id,credit_name,legal_first_name,legal_last_name,date_of_birth,pronouns')]);
      if(error)throw error;profiles=(state.profiles||[]).filter(p=>p.can_manage).map(p=>({...p,...(people||[]).find(x=>x.id===p.id)}));
      const box=document.createElement('fieldset');box.dataset.householdPicker='true';box.style.cssText='border:1px solid #74a2b4;border-radius:10px;padding:1rem;margin:1rem 0;';
      const legend=document.createElement('legend');legend.textContent='Who is auditioning?';box.append(legend);
      const select=document.createElement('select');select.id='bts-family-performer';select.style.cssText='width:100%;max-width:100%;padding:.7rem;font:inherit;';
      select.add(new Option('Choose a performer',''));
      profiles.forEach(p=>select.add(new Option(p.name||p.credit_name,p.id)));
      box.append(select);
      const help=document.createElement('p');help.textContent='Use an existing profile to keep bookings together. Another adult must confirm booking permission. Your time choice is saved; availability is checked again when you confirm.';help.style.fontSize='.85rem';box.append(help);
      const link=document.createElement('a');link.href='/member/circles?action=create-profile';link.target='_blank';link.rel='noopener';link.textContent='Add a profile';box.append(link);
      const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh profiles';refresh.onclick=async()=>{mounted=false;box.remove();await mount();};box.append(document.createTextNode(' '),refresh);
      help.textContent='Choose an existing profile. To add someone, open Add a profile in a new tab. Choose or create a circle first, then add their name, date of birth and photo. Return here and refresh profiles. Your form stays open; audition times are checked again when you submit.';
      const review=document.createElement('button');review.type='button';review.textContent='Review saved audition details';const reviewStatus=document.createElement('p');reviewStatus.setAttribute('role','status');review.onclick=async()=>{if(reviewBusy)return;const id=select.value;if(!id){reviewStatus.textContent='Choose who is auditioning first.';return;}reviewBusy=true;review.disabled=true;try{const {reviewAuditionProfile}=await import('/ASSETS/scripts/account/audition-profile-review.js?v=20261125-member-completion');const data=await reviewAuditionProfile(sb,id,{});rememberReview(id,data);if(data.experience)field('app-experience',data.experience);const photo=data.custom_answers?.__bts_profile_submission?.headshot_url;if(photo){const input=document.getElementById('app-photo')||document.getElementById('bk-headshot-input')||document.getElementById('st-headshot-input');if(input){const signed=await window.BTSPrivateMedia.authorisedUrl(photo),response=await fetch(signed);if(!response.ok)throw Error('The saved headshot could not load.');const blob=await response.blob();const transfer=new DataTransfer();transfer.items.add(new File([blob],'saved-headshot.'+(blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg'),{type:blob.type}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));}}reviewStatus.textContent='Selected profile details are ready for this audition. Complete the production’s remaining questions before submitting.';}catch(error){reviewed=null;reviewStatus.textContent=error.message||'The saved details could not load.';}finally{reviewBusy=false;review.disabled=false;}};box.append(document.createTextNode(' '),review,reviewStatus);
      host.prepend(box);
      select.addEventListener('change',()=>{reviewed=null;reviewStatus.textContent='';for(const id of ['app-photo','bk-headshot-input','st-headshot-input']){const input=document.getElementById(id);if(input)input.value='';}window.dispatchEvent(new CustomEvent('bts:audition-profile-changed',{detail:{profile_id:select.value}}));
        const p=profiles.find(x=>x.id===select.value);if(!p)return;
        const names=String(p.name||p.credit_name||'').split(' ');const first=p.legal_first_name||names[0];const last=p.legal_last_name||names.slice(1).join(' ');
        field('app-name',p.name||p.credit_name);field('app-dob',p.date_of_birth);
        for(const prefix of ['bk','st']){field(prefix+'-perf-fname',first);field(prefix+'-perf-lname',last);field(prefix+'-perf-bday',p.date_of_birth);}
        sessionStorage.setItem('bts_booking_profile',p.id);
      });
      const saved=sessionStorage.getItem('bts_booking_profile');if(profiles.some(p=>p.id===saved)){select.value=saved;select.dispatchEvent(new Event('change'));}
    } catch { mounted=false; }
  }
  async function prepare(sb,payload) {
    await mount();const picker=document.getElementById('bts-family-performer');
    const id=payload.profile_id||picker?.value;
    if(!id||id.startsWith('new:')){picker?.focus();throw new Error('Choose an existing profile. Use Add a profile to create or choose a circle before adding someone.');}
    const {reviewAuditionProfile}=await import('/ASSETS/scripts/account/audition-profile-review.js?v=20261125-member-completion');
    const permission=await sb.rpc('bts_profile_access',{p_profile_id:id,p_manage:true});if(permission.error||permission.data!==true)throw Error('Confirm permission for this profile before submitting.');
    if(reviewBusy)throw Error('Wait for your selected audition details to finish loading.');
    if(reviewed?.id===id){const data=reviewed.data;return {...payload,...data,custom_answers:{...(payload.custom_answers||{}),...(data.custom_answers||{})}};}
    const data=await reviewAuditionProfile(sb,id,payload);rememberReview(id,data);return data;
  }
  const style=document.createElement('link');style.rel='stylesheet';style.href='/ASSETS/styles/audition-profile-review.css?v=20261125-member-completion';document.head.append(style);
  window.BTSHouseholdBooking={prepare};
  new MutationObserver(()=>mount()).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',()=>{if(!mounted)mount();},{passive:true});mount();
}());
