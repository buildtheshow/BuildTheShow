export type FamilyJob = { id:string; to:string; kind:string; performer?:string; profile_id?:string; payload:Record<string,unknown> };
const escape = (value:unknown) => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function circleInvitation(job:FamilyJob,link:string) {
  const inviter=String(job.payload.inviter||'A circle member');
  const circle=String(job.payload.circle||'a circle');
  const members=Array.isArray(job.payload.profiles)?job.payload.profiles.map(String):[];
  const heading=inviter+' invited you to join '+circle+'.';
  const intro=inviter+' would like you to help keep track of shared production plans, from auditions and rehearsals to performances and volunteer shifts.';
  const access=members.length ? 'You’ll be able to help manage these members’ shared profiles and production activities. Other members’ profiles aren’t included. Your own profile stays private.' : 'Member profile access is shared separately. Your own profile stays private.';
  const next='Use your own Build The Show account with the email address that received this invitation. New here? You can create an account when you open it.';
  const confirmation='You can accept or decline after reviewing the details. Nothing is shared with you until you accept. For a child, you’ll also need to confirm you’re their parent or legal guardian.';
  const unexpected='Not expecting this? You can decline the invitation or leave it unanswered.';
  const p='font-size:15px;line-height:1.6;margin:0 0 16px;';
  const small='font-size:13px;line-height:1.6;color:#572e88;margin:0;';
  const h2='font-size:16px;line-height:1.4;margin:22px 0 9px;font-weight:700;';
  return {
    subject:inviter+' invited you to join '+circle,
    text:[heading,intro,'Circle: '+circle,'Invited by: '+inviter,'Your role: Admin',...(members.length?['Who you’re being invited to help with:\n'+members.map(member=>'- '+member).join('\n')]:[]),access,'Ready to take a look?',next,'Review invitation: '+link,confirmation,unexpected].join('\n\n'),
    html:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;padding:24px 12px;background:#efefef;font-family:Arial,Helvetica,sans-serif;color:#000000;">'+
      '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">'+escape(inviter+' invited you to '+circle+'. Review the members and choose whether to join.')+'</div>'+
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;margin:0 auto;border-collapse:separate;background:#ffffff;border-radius:16px;overflow:hidden;"><tr><td style="padding:23px 26px;background:#572e88;border-radius:16px 16px 0 0;"><img src="https://buildtheshow.com/ASSETS/Images/LogoBrand/logo-long-white.png" width="190" alt="Build The Show" style="display:block;width:190px;max-width:100%;height:auto;color:#ffffff;"></td></tr>'+
      '<tr><td style="padding:28px 26px;"><p style="font-size:12px;letter-spacing:1px;font-weight:700;color:#572e88;margin:0 0 12px;">CIRCLE INVITATION</p><h1 style="font-size:28px;line-height:1.2;margin:0 0 18px;font-weight:800;">'+escape(heading)+'</h1><p style="'+p+'">'+escape(intro)+'</p>'+
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2f8;border-radius:12px;margin:20px 0;"><tr><td width="48" style="padding:17px 0 17px 17px;vertical-align:middle;"><img src="https://buildtheshow.com/ASSETS/Images/Email/circle-home.png?v=20261121-circle-connections" width="35" height="35" alt="" style="display:block;width:35px;height:35px;"></td><td style="padding:17px 14px;vertical-align:middle;"><strong style="display:block;font-size:19px;margin:0 0 4px;">'+escape(circle)+'</strong><span style="font-size:14px;line-height:1.5;color:#572e88;">'+escape('Invited by '+inviter+' · Your role: Admin')+'</span></td></tr></table>'+
      (members.length?'<h2 style="'+h2+'">Who you’re being invited to help with</h2><ul style="font-size:15px;line-height:1.6;padding-left:20px;margin:0 0 10px;">'+members.map(member=>'<li>'+escape(member)+'</li>').join('')+'</ul>':'')+
      '<p style="'+p+'">'+escape(access)+'</p><h2 style="'+h2+'">Ready to take a look?</h2><p style="'+p+'">'+escape(next)+'</p>'+
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:5px 0 17px;"><tr><td bgcolor="#efab45" style="border-radius:9px;"><a href="'+escape(link)+'" style="display:inline-block;padding:14px 21px;color:#000000;font-size:15px;line-height:1.5;font-weight:700;text-decoration:none;border:1px solid #efab45;border-radius:9px;">Review invitation →</a></td></tr></table>'+
      '<p style="'+small+'">'+escape(confirmation)+'</p></td></tr><tr><td style="padding:20px 26px;border-top:1px solid #efefef;"><p style="'+small+'">'+escape(unexpected)+'</p></td></tr></table></body></html>'
  };
}

export function familyMessage(job:FamilyJob) {
  const base='https://buildtheshow.com/member/circles';
  const name=job.performer || 'your performer';
  let subject='A shared performer record changed';
  let text='An authorised person updated a booking, registration, payment tracker or access permission for '+name+'. Sign in to review the change history.';
  let link=base;let label='Open My Circle';
  if(job.kind==='circle_access_request') {
    subject=String(job.payload.inviter||'An adult member')+' asked to help in '+String(job.payload.circle||'a circle');
    text=String(job.payload.inviter||'An adult member')+' is asking to help with someone whose profile you manage, in '+String(job.payload.circle||'their circle')+'. Sign in using the email that received this request. You choose which member, if any, to share. No profile access has been added.';
    link=base+'?request='+encodeURIComponent(String(job.payload.request_id));label='Review access request';
  } else if(job.kind==='volunteer_history'){subject='Confirm your older volunteer records';text='Confirm which authorised profile should hold the older volunteer records for '+name+'. You must use the adult account receiving this email. A matching name alone does not grant access.';link='https://buildtheshow.com/member/home#volunteer-claim='+encodeURIComponent(String(job.payload.token));label='Review older volunteer records';
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
    if(kind==='household'){const circle=String(job.payload.circle||'a circle');const members=Array.isArray(job.payload.profiles)?job.payload.profiles.map(String).join(', '):'';subject='Invitation to '+circle;text=String(job.payload.inviter||'An adult member')+' invited you to join '+circle+' as an Admin. '+(members?'You can help manage '+members+'. Other members are not included.':'Member profile access is shared separately.')+' Use your own account to review the invitation and accept or decline. Your personal profile stays private.';}
    else if(job.payload.circle){subject='Invitation to help with '+name;text=String(job.payload.inviter||'An adult member')+' agreed to let you help with '+name+' in '+String(job.payload.circle)+'. Review the permission using your own account before accepting. A child’s invitation requires confirmation that you are their parent or legal guardian.';}
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
  if(job.kind==='invitation' && job.payload.permission==='household') return circleInvitation(job,link);
  const preferences=job.payload.preference_token ? base+'#unsubscribe='+encodeURIComponent(String(job.payload.preference_token)) : null;
  return { subject,text:text+'\n\n'+label+': '+link+(preferences?'\nEmail preferences: '+preferences:''),html:'<!doctype html><html><body style="font-family:Arial,sans-serif;color:#000000;line-height:1.6;max-width:600px;margin:auto;padding:24px"><h1 style="color:#572e88;font-size:24px">'+escape(subject)+'</h1><p>'+escape(text)+'</p><p><a style="display:inline-block;padding:12px 18px;background:#572e88;color:#ffffff;border-radius:8px;text-decoration:none" href="'+escape(link)+'">'+escape(label)+'</a></p>'+(preferences?'<p><a href="'+escape(preferences)+'">Email preferences</a></p>':'')+'<p>Build The Show</p></body></html>' };
}
export async function deliverFamilyMail(job:FamilyJob,config:{key:string;from:string},fetcher:typeof fetch=fetch) {
  const message=job.kind==='production_template' ? {subject:String(job.payload.subject||''),html:String(job.payload.html||''),text:String(job.payload.text||'')} : familyMessage(job);
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json','Idempotency-Key':'household/'+job.id},body:JSON.stringify({from:job.kind==='production_template'?String(job.payload.from||config.from):config.from,to:[job.to],...(job.payload.reply_to?{reply_to:String(job.payload.reply_to)}:{}),...message})});
  if(!response.ok)throw new Error('Email provider rejected delivery ('+response.status+').');
  const body=await response.json();return String(body.id || '');
}
