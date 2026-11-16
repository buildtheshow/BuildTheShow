import {supabase as client} from '/ASSETS/scripts/supabase.js';
const params=new URLSearchParams(location.search);
const parts=location.pathname.split('/').filter(Boolean);
const people=/\/portals(?:\.html)?$/i.test(location.pathname);
const participant=/\/portal\/?$/i.test(location.pathname)||params.get('space')==='activities';
async function run(){
 if(!await BTSAccountSecurity.requireAdultLogin(client))return;
 let id=params.get('production')||params.get('id')||'';
 if(!id){const result=await client.rpc('bts_production_from_link',{p_org:params.get('org')||parts[0]||'',p_show:params.get('show')||parts[1]||''});if(result.error)throw result.error;id=result.data;}
 if(!id)throw {code:'P0001',message:'This production link could not be resolved. Open My Home or ask the production team for its current link.'};
 if(participant){location.replace('/activities?production='+encodeURIComponent(id));return;}
 const result=await client.rpc('bts_my_home',{p_production_id:id});if(result.error)throw result.error;
 const memberships=result.data.management.filter(p=>p.id===id);
 const owner=memberships.find(p=>['owner','admin'].includes(p.organisation_access));
 if(owner){location.replace('/org/production?'+new URLSearchParams({id,...(people?{tab:'team'}:{})}));return;}
 if(memberships.length===1&&memberships[0].team_member_id){const member=memberships[0].team_member_id;const opened=await client.rpc('bts_open_production',{p_production_id:id,p_member_id:member});if(opened.error)throw opened.error;location.replace('/org/production?'+new URLSearchParams({id,team:'1',member}));return;}
 location.replace('/manage?production='+encodeURIComponent(id));
}
run().catch(error=>{document.getElementById('entry-status').textContent=error.code==='P0001'?error.message:'We could not check your access. Please try again.';});
