const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const profiles=[{id:'11111111-1111-4111-8111-111111111111',name:'Synthetic child',can_manage:true,can_volunteer:true,kind:'child',state:'active'}];
  const production={id:'22222222-2222-4222-8222-222222222222',title:'Synthetic show',slug:'show',organization_id:'org',registration_settings:{},registration_households:[],volunteer_staffing_plan:{}};
  const home={profiles,productions:[{...production,organisation_slug:'org'}],activities:[],events:[],volunteers:[{id:'shift',profile_id:profiles[0].id,production_id:production.id,name:'Synthetic child',role_name:'Usher',status:'approved',shift_date:'2026-12-01',shift_start_time:'10:00',shift_end_time:'12:00',approved_hours:null,title:production.title}],organisations:[{id:'org',name:'Synthetic organisation',access:'owner'}],management:[{...production,organisation_access:'owner',team_member_id:null}]};
  const variant=new URLSearchParams(location.search).get('fixture');if(variant==='staff'){home.organisations=[];home.management[0].organisation_access=null;home.management[0].team_member_id='team';}if(variant==='member'){home.organisations=[];home.management=[];}
  window.testCalls=[];
  window.testClient={channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}}),removeChannel(){},auth:{getUser:async()=>({data:{user:location.search.includes('signedout')?null:{id:'adult',email:'adult@example.invalid'}}}),getSession:async()=>({data:{session:{user:{id:'adult'}}}}),signOut:async()=>({error:null}),signUp:async(input)=>{window.testSignup=input;return {data:{session:null},error:null};},signInWithPassword:async()=>({data:{user:{id:'adult',user_metadata:{account_type:'organization'}}}})},rpc:async(name,args={})=>{window.testCalls.push({name,args});if(name==='bts_profile_type_options')return {data:{members:[{id:'person',name:'Synthetic adult'}],organisations:[{id:'org',name:'Synthetic organisation'}],history:[],person_name:'Synthetic Adult'}};if(name==='bts_correct_profile_type')return location.search.includes('review')?{data:{id:'review-reference',state:'needs_review',message:'Review requested. No profile type or access has changed.'}}:{data:{id:'completed-reference',state:'completed',target_id:'corrected',target_type:args.p_source_type==='member'?'organisation':'member',message:'Profile setup corrected.'}};if(name==='bts_get_account_status')return {data:{active:true}};if(name==='bts_my_home')return {data:home};if(name==='bts_public_volunteer_availability'||name==='public_production_contact')return {data:[]};if(name==='bts_request_volunteer_shifts')return {data:{ids:['created'],portal_token:'private',email:'adult@example.invalid',count:1}};if(name==='bts_confirm_volunteer_history')return {data:{person:'Synthetic child',production:production.title,count:1,email:'adult@example.invalid',record_reference:'synthetic'}};if(name==='bts_request_volunteer_history')return {data:{message:'Confirmation queued.'}};if(name==='bts_production_invitation')return {data:{production_id:production.id,production:production.title,position:'Director',email:'adult@example.invalid'}};if(name==='bts_open_production')return {data:[{session_token:'synthetic',team_member:{id:'team',production_id:production.id}}]};return {data:{ok:true}};},from:table=>{let fields='';const query={select(value){fields=value;return this;},eq(){return this;},order(){return this;},limit(){return this;},or(){return this;},in(){return this;},is(){return this;},neq(){return this;},gte(){return this;},lte(){return this;},single:async()=>({data:table==='bts_visible_organizations'?{id:'org',name:'Synthetic organisation',slug:'org'}:production}),maybeSingle:async()=>({data:table==='bts_visible_organizations'?{id:'org',name:'Synthetic organisation',slug:'org'}:production}),then(resolve){resolve({data:table==='bts_visible_productions'?[production]:[]});},update(){return this;}};return query;}};
 });
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase'))return route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>window.testClient};'});if(url.origin!=='http://bts.test')return route.abort();if(url.pathname==='/ASSETS/scripts/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase=window.testClient;'});if(url.pathname.includes('private-profile-media.js'))return route.fulfill({contentType:'text/javascript',body:''});if(url.pathname==='/org/production')return route.fulfill({contentType:'text/html',body:'<p>Synthetic production destination</p>'});if(url.pathname==='/manage')return route.fulfill({contentType:'text/html',body:'<script>location.replace("/org/dashboard")</script>'});let pathname=['/home','/activities'].includes(url.pathname)?'/PUBLIC/my-home.html':url.pathname==='/org/dashboard'?'/SYSTEM/Organisations/org-dashboard.html':url.pathname;const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream',body:fs.readFileSync(file)});});

 await page.goto('http://bts.test/SYSTEM/Members/Performer/performer-settings.html');
 await page.locator('[data-panel="profile"]').click();
 const card=page.locator('#profile-type-correction');
 await card.getByRole('button',{name:'Review profile correction'}).click();
 await card.getByLabel('Profile to correct').selectOption('person');
 await card.getByLabel('Organisation name',{exact:true}).fill('Synthetic Organisation');
 await card.getByLabel('Organisation contact email').fill('synthetic@example.invalid');
 await card.getByLabel('Organisation address (buildtheshow.com/your-name)').fill('synthetic-organisation');
 await card.getByRole('button',{name:'Confirm correction'}).click();
 assert.equal(await page.evaluate(()=>testCalls.filter(call=>call.name==='bts_correct_profile_type').length),0,'Confirmation must be checked');
 await card.getByRole('checkbox').check();
 for(const width of [320,768,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Member settings overflow '+width);}
 await card.screenshot({path:'/tmp/bts-member-profile-correction.png'});
 await card.getByRole('button',{name:'Confirm correction'}).click();
 await card.getByRole('link',{name:'Open the corrected profile'}).waitFor();
 assert.equal(await card.getByRole('link').getAttribute('href'),'/org/dashboard?id=corrected');
 assert.equal(await page.evaluate(()=>testCalls.find(call=>call.name==='bts_correct_profile_type').args.p_details.slug),'synthetic-organisation');
 await page.goto('http://bts.test/org/dashboard?tab=settings&review=1');
 await page.locator('.nav-item[data-tab="settings"]').click();
 await card.getByRole('button',{name:'Review profile correction'}).click();
 assert.equal(await card.getByLabel('Profile to correct').inputValue(),'org');
 await card.getByRole('checkbox').check();
 await card.getByRole('button',{name:'Confirm correction'}).click();
 await card.getByText('Review requested.',{exact:false}).waitFor();
 assert.equal(await card.getByRole('link',{name:'Open the corrected profile'}).count(),0);
 for(const width of [320,768,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Organisation settings overflow '+width);}
 await page.locator('#bts-page-loader').waitFor({state:'hidden'});
 await card.screenshot({path:'/tmp/bts-organisation-profile-correction.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: original member and organisation Settings, explicit confirmation, exact source, canonical correction call, honest review state, safe links and mobile widths. Synthetic APIs only; no emails sent.');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
