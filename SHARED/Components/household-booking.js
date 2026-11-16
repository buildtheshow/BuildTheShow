/* The booking form chooses a canonical performer; the database checks the actual key. */
(function () {
  'use strict';
  let clientPromise;let mountPromise;let mounted=false;let profiles=[];
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
      select.add(new Option('Create my own performer profile','new:self'));select.add(new Option('Create a child profile as their guardian','new:child'));select.add(new Option('Arrange permission for another adult','new:adult'));box.append(select);
      const help=document.createElement('p');help.textContent='Use an existing profile to keep bookings together. Another adult must confirm booking permission. Your time choice is saved; availability is checked again when you confirm.';help.style.fontSize='.85rem';box.append(help);
      const link=document.createElement('a');link.href='/member/households?action=create-profile';link.target='_blank';link.rel='noopener';link.textContent='Manage household profiles and permissions';box.append(link);
      host.prepend(box);
      select.addEventListener('change',()=>{
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
    if(payload.profile_id){const {data,error}=await sb.rpc('bts_profile_access',{p_profile_id:payload.profile_id,p_manage:true});if(error||data!==true)throw new Error('Confirm permission for this performer before booking.');return payload;}
    if(!picker?.value){picker?.focus();throw new Error('Choose who is auditioning in the performer section.');}
    if(picker.value==='new:adult')throw new Error('Open Households to create the adult profile and request permission. Return here once it is confirmed.');
    if(picker.value.startsWith('new:'))return {...payload,custom_answers:{...(payload.custom_answers||{}),__bts_profile_relationship:picker.value.slice(4)}};
    return {...payload,profile_id:picker.value};
  }
  window.BTSHouseholdBooking={prepare};
  new MutationObserver(()=>mount()).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',()=>{if(!mounted)mount();},{passive:true});mount();
}());
