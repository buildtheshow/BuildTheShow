import {supabase as sb} from '/ASSETS/scripts/supabase.js';
const $=id=>document.getElementById(id),root=$('account-settings');
let currentUser,busy=false,closing=false;
const keys=['production_updates','activity_reminders','circle_notifications'];
function message(text,error=false){$('settings-status').textContent=text;$('settings-status').setAttribute('role',error?'alert':'status');}
async function user(){const result=await sb.auth.getUser();if(result.error||!result.data?.user)throw new Error('Your session could not be checked. Sign in again.');return result.data.user;}
async function action(button,fn){if(busy)return;busy=true;button.disabled=true;message('');try{await fn();}catch(error){message(error.message||'This could not be saved. Please try again.',true);}finally{busy=false;button.disabled=false;}}
for(const button of root.querySelectorAll('[data-expand]'))button.onclick=()=>{const panel=$(button.dataset.expand);panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));};
function tab(id){for(const b of root.querySelectorAll('[data-section]'))b.setAttribute('aria-selected',String(b.dataset.section===id));for(const p of root.querySelectorAll('[role=tabpanel]'))p.hidden=p.id!=='sp-'+id;message('');}
for(const b of root.querySelectorAll('[data-section]')){b.onclick=()=>tab(b.dataset.section);b.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const tabs=[...root.querySelectorAll('[data-section]')],next=tabs[(tabs.indexOf(b)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];next.focus();tab(next.dataset.section);};}
$('email-save').onclick=event=>action(event.currentTarget,async()=>{
 const input=$('new-email'),email=input.value.trim();if(!email||!input.reportValidity())return;
 const me=await user();if(email.toLowerCase()===me.email.toLowerCase())throw new Error('That is already your login email.');
 const result=await sb.auth.updateUser({email},{emailRedirectTo:location.origin+'/login'});if(result.error)throw result.error;
 input.value='';message('Check your email for confirmation instructions, including junk or spam. Your login email stays the same until the change is confirmed.');
});
$('password-save').onclick=event=>action(event.currentTarget,async()=>{
 const password=$('new-password').value;if(password.length<12)throw new Error('Use at least 12 characters for your new password.');if(password!==$('confirm-password').value)throw new Error('Those passwords don’t match. Please type them again.');
 const result=await sb.auth.updateUser({password});if(result.error)throw result.error;$('new-password').value='';$('confirm-password').value='';message('Password updated.');
});
$('notifications-save').onclick=event=>action(event.currentTarget,async()=>{
 const me=await user(),preferences={...(me.user_metadata?.notification_preferences||{})};keys.forEach((key,index)=>preferences[key]=$('notification-'+index).checked);
 const result=await sb.auth.updateUser({data:{notification_preferences:preferences,marketing_consent:$('notification-3').checked}});if(result.error)throw result.error;currentUser=result.data?.user||me;message('Your notification preferences are saved.');
});
$('download-data').onclick=event=>{event.preventDefault();action(event.currentTarget,async()=>{
 const me=await user(),snapshot=await sb.rpc('bts_circle',{p_action:'snapshot',p_data:{}});if(snapshot.error)throw snapshot.error;
 const ids=(snapshot.data?.profiles||[]).filter(profile=>profile.can_manage).map(profile=>profile.id);
 let profiles=[];if(ids.length){const result=await sb.from('profiles').select('*').in('id',ids);if(result.error)throw result.error;profiles=result.data||[];}
 const metadata=me.user_metadata||{};
 const data={exported_at:new Date().toISOString(),account:{email:me.email,created_at:me.created_at,first_name:metadata.first_name,last_name:metadata.last_name,marketing_consent:metadata.marketing_consent,notification_preferences:metadata.notification_preferences},managed_profiles:profiles};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='buildtheshow-my-data.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Your account and managed-profile download is ready. For other personal information, use “Request my information”.');
});};
$('logout-btn').onclick=async()=>{const result=await sb.auth.signOut();if(result.error){message('You could not be signed out. Please try again.',true);return;}sessionStorage.clear();location.replace('/login');};

    function openDeleteModal() {
      if(closing)return;
      // Reset all steps
      document.querySelectorAll('.del-step').forEach(s => s.classList.remove('active'));
      document.getElementById('del-step-1').classList.add('active');
      document.getElementById('del-chk1').checked = false;
      document.getElementById('del-chk2').checked = false;
      document.getElementById('del-chk3').checked = false;
      document.getElementById('del-contact-no').checked = true;
      document.getElementById('del-password').value = '';
      document.getElementById('del-error').classList.remove('visible');
      document.getElementById('del-step2-btn').disabled = true;
      document.getElementById('delete-modal').classList.add('open');
      $('delete-modal').focus();
    }

    function closeDeleteModal() {
      if(closing)return;
      $('close-account').focus();
      document.getElementById('delete-modal').classList.remove('open');
    }

    function delGoTo(step) {
      if(closing)return;
      document.querySelectorAll('.del-step').forEach(s => s.classList.remove('active'));
      document.getElementById('del-step-' + step).classList.add('active');
      if (step === 4) document.getElementById('del-password').focus();
    }

    function checkDelStep2() {
      const allChecked = document.getElementById('del-chk1').checked
        && document.getElementById('del-chk2').checked
        && document.getElementById('del-chk3').checked;
      document.getElementById('del-step2-btn').disabled = !allChecked;
    }


async function confirmDeleteAccount(){
 if(closing)return;
 const password=$('del-password').value,err=$('del-error'),button=$('del-final-btn');err.classList.remove('visible');
 if(!password){err.textContent='Enter your password to confirm.';err.classList.add('visible');return;}
 closing=true;button.disabled=true;button.textContent='Submitting...';
 try{
  const me=await user(),reauth=await sb.auth.signInWithPassword({email:me.email,password});if(reauth.error)throw new Error('That password could not be confirmed. Please try again.');
  const result=await sb.rpc('bts_request_account_deletion',{p_keep_production_contact:$('del-contact-yes').checked});if(result.error||!result.data?.request_id)throw new Error('Your request could not be recorded. Please try again.');
  closing=false;closeDeleteModal();message('Account closure request received. Reference: '+result.data.request_id+'. No information has been deleted. We’ll review linked profiles, circle and organisation ownership, and production records.');
 }catch(error){err.textContent=error.message;err.classList.add('visible');}
 finally{closing=false;button.disabled=false;button.textContent='Request account deletion';$('del-password').value='';}
}
Object.assign(window,{openDeleteModal,closeDeleteModal,delGoTo,checkDelStep2,confirmDeleteAccount});
$('close-account').onclick=openDeleteModal;
$('delete-modal').onclick=event=>{if(event.target===event.currentTarget&&!closing)closeDeleteModal();};
$('delete-modal').addEventListener('keydown',event=>{if(event.key==='Escape'&&!closing)closeDeleteModal();if(event.key==='Tab'){const buttons=[...$('delete-modal').querySelectorAll('button,input')].filter(e=>!e.disabled&&e.getClientRects().length),first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
async function init(){
 $('settings-retry').hidden=true;
 try{
  const session=await sb.auth.getSession();if(session.error)throw session.error;if(!session.data?.session){location.replace('/login?return=%2Fmember%2Fsettings');return;}
  currentUser=await user();if(!await window.BTSAccountSecurity.ensureAdultAccount(sb))return;
  const metadata=currentUser.user_metadata||{};const name=[metadata.first_name,metadata.last_name].filter(Boolean).join(' ')||metadata.full_name||'Your account';
  $('account-name').textContent=name;$('account-identity-email').textContent=currentUser.email;$('account-email').textContent=currentUser.email;$('sidebar-email').textContent=currentUser.email;
  keys.forEach((key,index)=>$('notification-'+index).checked=metadata.notification_preferences?.[key]!==false);$('notification-3').checked=metadata.marketing_consent===true;
  window.sb=sb;window.renderMemberSidebar('settings');await window.loadMemberSidebarProfile(sb);
  $('settings-load-status').hidden=true;$('settings-controls').hidden=false;
  if(currentUser.new_email)message('An email change is waiting for confirmation. Check your inbox, including junk or spam.');
 }catch(error){$('settings-load-status').textContent='Your account settings could not load. Please try again.';$('settings-retry').hidden=false;message(error.message,true);}
}
$('settings-retry').onclick=init;init();
