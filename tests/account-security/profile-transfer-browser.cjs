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
    if(name==='bts_profile_transfer'){window.transferCalls||=[];transferCalls.push(args);return {data:args.p_action==='status'?{eligible:true,name:'Synthetic Person',message:'Transfer this existing profile to its own adult login.'}:{id:'synthetic-transfer'}};}if(name==='bts_family'){window.accessCalls||=[];accessCalls.push(args);if(args.p_action==='contact_preference')window.accessOwnPreference=args.p_data.enabled;return {data:{ok:true,id:'request'}};}
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
   const mapped=u.pathname==='/member/settings'?'/SYSTEM/Members/Performer/performer-settings.html':u.pathname==='/member/profiles/own/edit'?'/SYSTEM/Members/Profiles/profile-sections.html':u.pathname;
   const file=path.resolve(root,'.'+mapped);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(file)});
  });

  await page.goto('http://bts.test/member/settings?section=profiles&profile=own');await page.locator('#profile-access-panel').waitFor({state:'visible'});await page.getByText('Transfer profile',{exact:true}).click();await page.getByLabel('New account holder’s email address',{exact:true}).fill('new-owner@example.invalid');await page.getByLabel('Circle membership',{exact:true}).selectOption('remove');await page.getByRole('checkbox',{name:'I understand that my management access will end after acceptance.',exact:true}).check();await page.getByRole('button',{name:'Send transfer invitation',exact:true}).click();await page.getByText('Transfer invitation queued.',{exact:false}).waitFor();assert.deepEqual(await page.evaluate(()=>transferCalls.at(-1)),{p_action:'request',p_profile_id:'own',p_email:'new-owner@example.invalid',p_keep_circle:false});for(const width of [320,768,1280]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}assert.deepEqual(errors,[]);console.log('PASS: transfer in existing Profile settings, new email, explicit circle choice, acknowledgement, queued confirmation and responsive widths. No emails sent.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
