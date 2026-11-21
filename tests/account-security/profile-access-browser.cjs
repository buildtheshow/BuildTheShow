const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const canonical='https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/profile-headshots/account/original.jpg';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://bts.test']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({canonical})=>{
   window.testState={updates:[],uploads:[],bindings:[],signs:[],reads:0,denied:new URLSearchParams(location.search).has('denied'),conflict:false,failUpload:false,failBind:false};
   const initial={id:'own',credit_name:'Synthetic Person',nickname:'Nick',pronouns:'They/Them',date_of_birth:'1990-01-01',bio:'Saved bio',headshot_url:canonical,headshot_urls:[canonical],profile_display_id:'BTS-TEST-01',sections:{extra:{keep:'private'},performer:{enabled:true,training:'Existing training',resume_url:canonical.replace('original.jpg','original.pdf'),unknown:'keep'},volunteer:{enabled:true,skills:{props:'lots'},comfort:{noise:'prefer-not'},history:[]},creative:{enabled:true,roles:{director:{enabled:true,experience:'Earlier directing text'}}}}};
   let profile=JSON.parse(sessionStorage.getItem('test-profile')||'null')||initial;
   window.testProfile=()=>profile;
   window.testClient={auth:{getSession:async()=>({data:{session:{user:{id:'account',email:'synthetic@example.invalid'}}}}),getUser:async()=>({data:{user:{id:'account',email:'synthetic@example.invalid'}}}),signOut:async()=>({})},rpc:async(name,args)=>{
    if(name==='bts_member_profile_access')return {data:{profile_id:'own',name:'Synthetic Person',kind:'child',is_subject:false,can_invite:true,keys:[{id:'account',name:'Parent A',kind:'guardian',is_me:true,is_manager:true,receives_updates:true},{id:'other',name:'Parent B',kind:'guardian',is_me:false,receives_updates:true}],my_contacts:[{id:'contact-own',email:'synthetic@example.invalid',active:window.accessOwnPreference??true}],sent_invitations:[],history:[]}};
    if(name==='bts_family'){window.accessCalls||=[];accessCalls.push(args);if(args.p_action==='contact_preference')window.accessOwnPreference=args.p_data.enabled;return {data:{ok:true,id:'request'}};}
    if(name==='bts_get_account_status')return {data:{active:true}};
    if(name==='bts_profile_access')return {data:!testState.denied};
    if(name==='bts_profile_identity_edit')return {data:true};
    if(name==='bts_circle')return {data:{profiles:[{id:'own',name:profile.credit_name,is_subject:true,can_manage:true}],circles:[]}};
    if(name==='bts_bind_profile_file'){testState.bindings.push(args);return {data:!testState.failBind};}
    return {data:null};
   },from(table){let update=null;const filters=[];return {select(){return this;},eq(k,v){filters.push([k,v]);return this;},is(k,v){filters.push([k,v]);return this;},update(value){update=value;return this;},async single(){testState.reads++;return {data:structuredClone(profile)};},async maybeSingle(){if(update){testState.updates.push(structuredClone(update));if(testState.conflict)return {data:null};for(const[k,v]of filters){if(k==='id')continue;const expected=k==='sections'?JSON.parse(v):k==='headshot_urls'?JSON.parse('['+v.slice(1,-1)+']'):v;if(JSON.stringify(profile[k]??null)!==JSON.stringify(expected??null))return {data:null};}profile={...profile,...structuredClone(update)};sessionStorage.setItem('test-profile',JSON.stringify(profile));return {data:{id:'own'}};}return {data:table==='profiles'?structuredClone(profile):{display_id:'BTS-TEST'}};}};},storage:{from(bucket){return {async createSignedUrl(file,seconds){testState.signs.push({bucket,file,seconds});return {data:{signedUrl:'http://bts.test/signed/'+encodeURIComponent(file)}};},async upload(file,body,options){testState.uploads.push({bucket,file,options});return testState.failUpload?{error:{message:'offline'}}:{data:{path:file}};},getPublicUrl(file){return {data:{publicUrl:'https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/'+bucket+'/'+file}};}};}}};
  },{canonical});
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.origin!=='http://bts.test')return route.abort();
   if(u.pathname==='/ASSETS/scripts/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase=window.testClient;'});
   if(u.pathname.startsWith('/signed/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect width="80" height="100" fill="#572e88"/></svg>'});
   const mapped=u.pathname==='/member/profiles/own/edit'?'/SYSTEM/Members/Profiles/profile-sections.html':u.pathname;
   const file=path.resolve(root,'.'+mapped);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(file)});
  });

  await page.goto('http://bts.test/member/profiles/own/edit');await page.locator('#profile-form').waitFor({state:'visible'});assert.equal(await page.getByRole('tab').count(),4);await page.locator('#profile-settings>summary').click();await page.locator('#profile-access-panel strong').getByText('Parent B',{exact:true}).waitFor();assert.ok(!(await page.locator('#profile-access-panel').textContent()).includes('private-parent@example.invalid'));assert.equal(await page.locator('#profile-settings').getByText('Payments',{exact:true}).count(),0);
  await page.locator('#profile-access-panel').getByLabel('Email me updates',{exact:true}).uncheck();await page.locator('#profile-access-panel [role=status]').filter({hasText:'preference is saved'}).waitFor();assert.equal(await page.evaluate(()=>accessCalls.find(c=>c.p_action==='contact_preference').p_data.contact_id),'contact-own');assert.equal(await page.locator('#profile-access-panel').getByLabel('Email me updates',{exact:true}).isChecked(),false);
  await page.locator('#profile-access-panel').getByRole('button',{name:'Invite an admin',exact:true}).click();await page.locator('#profile-access-panel').getByLabel('Their email address',{exact:true}).fill('another@example.invalid');await page.locator('#profile-access-panel').getByRole('button',{name:'Send invitation',exact:true}).click();await page.locator('#profile-access-panel [role=status]').filter({hasText:'Invitation queued'}).waitFor();assert.equal(await page.evaluate(()=>accessCalls.find(c=>c.p_action==='invite').p_data.kind),'guardian');assert.equal(await page.evaluate(()=>accessCalls.find(c=>c.p_action==='invite').p_data.profile_id),'own');
  await page.locator('#profile-access-panel').getByText('Ask us to review access',{exact:true}).click();await page.locator('#profile-access-panel').getByLabel('Tell us what needs changing',{exact:true}).fill('Please review this synthetic guardian access.');await page.locator('#profile-access-panel').getByRole('button',{name:'Send review request',exact:true}).click();await page.locator('#profile-access-panel [role=status]').filter({hasText:'No access has changed'}).waitFor();
  for(const width of [320,768,1280]){await page.setViewportSize({width,height:1100});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Overflow '+width);}assert.deepEqual(errors,[]);console.log('PASS: four profile tabs, scoped inline profile access, own notification preference, recipient invitation, protected review and responsive widths. Synthetic APIs only.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
