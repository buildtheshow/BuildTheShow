import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { deliverFamilyMail } from './delivery.ts';
Deno.serve(async request => {
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'https://buildtheshow.com','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return new Response('{}',{status:405,headers});
  // Public pump only: callers cannot choose recipients, content, tokens or job IDs.
  try {const input=await request.json();if(!input||Object.keys(input).length)return new Response('{}',{status:400,headers});}catch{return new Response('{}',{status:400,headers});}
  const key=Deno.env.get('RESEND_API_KEY')||'';const from=Deno.env.get('FROM_EMAIL')||'';
  if(!key||!from)return new Response(JSON.stringify({error:'Email delivery is not configured.'}),{status:503,headers});
  const service=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
  const {data:jobs,error}=await service.rpc('bts_family_mail_claim');
  if(error)return new Response(JSON.stringify({error:'Queue unavailable.'}),{status:503,headers});
  let sent=0,failed=0;
  for(const job of jobs||[]) {
    await new Promise(resolve=>setTimeout(resolve,600));
    try {
      const preference=await service.rpc('bts_account_mail_allowed',{p_job_id:job.id});
      if(preference.error)throw new Error('Notification preferences could not be checked.');
      if(preference.data!==true)continue;
      let provider='';
      if(job.kind==='render_booking'){
        const source=job.payload.table==='audition_bookings'?{booking_id:job.payload.record_id}:{applicant_id:job.payload.record_id};
        const rendered=await service.functions.invoke('send-email',{body:{production_id:job.payload.production_id,category:job.payload.category,...source}});
        if(rendered.error||rendered.data?.ok!==true)throw new Error('Booking confirmation could not be rendered from the configured template.');provider='template-queued';
      }else provider=await deliverFamilyMail(job,{key,from});const done=await service.rpc('bts_family_mail_finish',{p_id:job.id,p_success:true,p_provider_id:provider,p_error:null});if(done.error)throw new Error('Delivery acknowledgement unavailable.');sent++;}
    catch(error){failed++;await service.rpc('bts_family_mail_finish',{p_id:job.id,p_success:false,p_provider_id:null,p_error:error instanceof Error?error.message:'Delivery failed.'});}
  }
  return new Response(JSON.stringify({sent,failed}),{headers});
});
