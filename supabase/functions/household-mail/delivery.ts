export type FamilyJob = { id:string; to:string; kind:string; performer?:string; profile_id?:string; payload:Record<string,unknown> };
const escape = (value:unknown) => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function familyMessage(job:FamilyJob) {
  const base='https://buildtheshow.com/member/circles';
  const name=job.performer || 'your performer';
  let subject='A shared performer record changed';
  let text='An authorised person updated a booking, registration, payment tracker or access permission for '+name+'. Sign in to review the change history.';
  let link=base;let label='Open My Circle';
  if(job.kind==='volunteer_history'){subject='Confirm your older volunteer records';text='Confirm which authorised profile should hold the older volunteer records for '+name+'. You must use the adult account receiving this email. A matching name alone does not grant access.';link='https://buildtheshow.com/member/home#volunteer-claim='+encodeURIComponent(String(job.payload.token));label='Review older volunteer records';
  } else if(job.kind==='team_invitation') {
    subject='Your production access invitation';text='You have been invited to help manage '+String(job.payload.production||'a production')+'. Accept using your own adult account and the email that received this invitation.';link='https://buildtheshow.com/member/home#team-invite='+encodeURIComponent(String(job.payload.token));label='Review production invitation';
  } else if(job.kind==='org_invitation') {
    subject='Your organisation invitation';text='You have been invited to join '+String(job.payload.organisation||'an organisation')+'. Accept using your own adult account.';link='https://buildtheshow.com/invite?token='+encodeURIComponent(String(job.payload.token));label='Review organisation invitation';
  } else if(job.kind==='volunteer_updated') {
    subject='Your volunteer activity changed';text='A volunteer request, assignment or confirmed hours changed for '+name+'. Open My Activities to review the current details.';link='https://buildtheshow.com/member/activities?production='+encodeURIComponent(String(job.payload.production_id||''));label='Open My Activities';
  } else if(job.kind==='invitation') {
    subject='Confirm a Build The Show invitation';
    const kind=String(job.payload.permission||'access');
    text=kind==='delegate' ? 'Someone would like to manage bookings for '+name+'. Confirm only if this is your profile and you want that help. You do not need a regular login to confirm. You can stop this permission later.' : kind==='contact' ? 'You have been invited to receive production updates for '+name+'. This does not give account access.' : kind==='household' ? 'You have been invited to join a circle. This does not automatically grant access to performer profiles.' : 'You have been invited to manage '+name+' using your own adult login. Accept only if you are authorised to do this.';
    if(kind==='household'){const circle=String(job.payload.circle||'a circle');const members=Array.isArray(job.payload.profiles)?job.payload.profiles.map(String).join(', '):'';subject='Your circle admin invitation';text='You have been invited to join '+circle+' as an Admin. '+(members?'This invitation shares access to '+members+'. Existing access stays as it is.':'Member profile access is shared separately.')+' Use your own adult login to review and accept.';}
    link=base+'#invite='+encodeURIComponent(String(job.payload.token));label='Review invitation';
  } else if(job.kind==='consent_receipt') {
    subject='Your permission confirmation';
    text='Your permission for '+name+' was recorded. Notification contacts and account access are separate. You can manage email preferences using the link below.';
    link=job.payload.permission==='delegate' ? base+'#consent='+encodeURIComponent(String(job.payload.token)) : base+'#unsubscribe='+encodeURIComponent(String(job.payload.token));
    label=job.payload.permission==='delegate'?'Manage permission or activate your login':'Manage email preferences';
  } else if(job.kind==='access_review') {
    subject='Your access review has a decision';text='The requested access review for '+name+' has been '+(job.payload.approved?'approved':'declined')+'. Sign in to review the result.';
  } else if(job.kind==='access_removed') {
    subject='Your performer access changed';text='Your permission to manage '+name+' has ended. Contact the access manager or request an operator review if this is unexpected.';
  }
  const preferences=job.payload.preference_token ? base+'#unsubscribe='+encodeURIComponent(String(job.payload.preference_token)) : null;
  return { subject,text:text+'\n\n'+label+': '+link+(preferences?'\nEmail preferences: '+preferences:''),html:'<!doctype html><html><body style="font-family:Arial,sans-serif;color:#000000;line-height:1.6;max-width:600px;margin:auto;padding:24px"><h1 style="color:#572e88;font-size:24px">'+escape(subject)+'</h1><p>'+escape(text)+'</p><p><a style="display:inline-block;padding:12px 18px;background:#572e88;color:#ffffff;border-radius:8px;text-decoration:none" href="'+escape(link)+'">'+escape(label)+'</a></p>'+(preferences?'<p><a href="'+escape(preferences)+'">Email preferences</a></p>':'')+'<p>Build The Show</p></body></html>' };
}
export async function deliverFamilyMail(job:FamilyJob,config:{key:string;from:string},fetcher:typeof fetch=fetch) {
  const message=job.kind==='production_template' ? {subject:String(job.payload.subject||''),html:String(job.payload.html||''),text:String(job.payload.text||'')} : familyMessage(job);
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json','Idempotency-Key':'household/'+job.id},body:JSON.stringify({from:job.kind==='production_template'?String(job.payload.from||config.from):config.from,to:[job.to],...(job.payload.reply_to?{reply_to:String(job.payload.reply_to)}:{}),...message})});
  if(!response.ok)throw new Error('Email provider rejected delivery ('+response.status+').');
  const body=await response.json();return String(body.id || '');
}
