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
   window.testClient={auth:{getSession:async()=>({data:{session:{user:{id:'account',email:'synthetic@example.invalid'}}}}),getUser:async()=>({data:{user:{id:'account'}}}),signOut:async()=>({})},rpc:async(name,args)=>{
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
  await page.goto('http://bts.test/member/profiles/own/edit');await page.locator('#profile-form').waitFor({state:'visible'});
  assert.equal(await page.getByRole('tab').count(),4);assert.equal(await page.locator('#field-bio').inputValue(),'Saved bio');
  await page.locator('#field-bio').fill('A new private bio');
  await page.getByRole('tab',{name:'Volunteer',exact:true}).click();
  let entry=page.locator('#panel-volunteer .pm-history-entry').first();
  await entry.getByLabel('Production title',{exact:true}).fill('Synthetic Circus');await entry.getByLabel('Organisation',{exact:true}).fill('Circus Collective');await entry.getByLabel('Role',{exact:true}).fill('Props');await entry.getByLabel('Year',{exact:true}).fill('2025');await entry.getByLabel('What did you do?',{exact:true}).fill('Prepared and repaired props.');
  await page.getByRole('tab',{name:'Creative Team',exact:true}).click();
  entry=page.locator('#panel-creative .pm-history-entry').first();assert.equal(await entry.getByLabel('What did you do?',{exact:true}).count(),0);
  await entry.getByLabel('Production title',{exact:true}).fill('Synthetic Dance');await entry.getByLabel('Role',{exact:true}).fill('Choreographer');
  await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('#profile-save-status').getByText('Saved. Nothing has been published or sent.',{exact:true}).waitFor();
  let data=await page.evaluate(()=>testProfile());assert.equal(data.bio,'A new private bio');assert.equal(data.sections.volunteer.history[0].title,'Synthetic Circus');assert.equal(data.sections.creative.history[0].role,'Choreographer');assert.equal(data.sections.creative.roles.director.experience,'Earlier directing text');assert.equal(data.sections.volunteer.skills.props,'lots');assert.equal(data.sections.extra.keep,'private');assert.equal(data.sections.performer.unknown,'keep');assert.equal(data.sections.performer.resume_url,canonical.replace('original.jpg','original.pdf'));
  assert.ok(!('date_of_birth'in(await page.evaluate(()=>testState.updates[0]))));
  await page.reload();await page.locator('#profile-form').waitFor({state:'visible'});assert.equal(await page.locator('#field-bio').inputValue(),'A new private bio');
  await page.getByRole('tab',{name:'Volunteer',exact:true}).click();assert.equal(await page.locator('#panel-volunteer').getByLabel('Production title',{exact:true}).inputValue(),'Synthetic Circus');
  await page.getByRole('tab',{name:'Headshots',exact:true}).click();await page.locator('#profile-headshots .pm-shot img').waitFor();assert.ok(await page.locator('#profile-headshots .pm-shot img').getAttribute('src').then(src=>src.includes('/signed/')));assert.ok(await page.evaluate(()=>testState.signs.every(s=>s.seconds===300)));
  // Failed uploads must not write the record or display success.
  await page.evaluate(()=>testState.failUpload=true);
  await page.locator('#profile-photo-input').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await page.locator('#profile-headshots .pm-photo-item').nth(1).waitFor();
  await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('#profile-save-status').getByText('A photo could not upload. Nothing was saved. Try again.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>testState.updates.length),0);
  await page.evaluate(()=>{testState.failUpload=false;testState.failBind=true;});await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('#profile-save-status').getByText('The file uploaded but could not be attached to this profile. Try saving again.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>testState.updates.length),0);
  await page.evaluate(()=>testState.failBind=false);await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('#profile-save-status').getByText('Saved. Nothing has been published or sent.',{exact:true}).waitFor();
  data=await page.evaluate(()=>testProfile());assert.equal(data.headshot_urls.length,2);assert.ok(data.headshot_urls[1].includes('/account/own/'));assert.ok(await page.evaluate(()=>testState.uploads.every(u=>u.options.upsert===false)));assert.ok(await page.evaluate(()=>testState.bindings.every(b=>b.p_profile_id==='own')));
  // A saved PDF is preserved through unrelated changes and new PDFs are private-bound.
  await page.getByRole('tab',{name:'Creative Team',exact:true}).click();await page.locator('#panel-creative details').last().locator('summary').click();
  await page.locator('#panel-creative input[type=file]').setInputFiles({name:'cv.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')});await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('#profile-save-status').getByText('Saved. Nothing has been published or sent.',{exact:true}).waitFor();data=await page.evaluate(()=>testProfile());assert.ok(data.sections.creative.resume_url.endsWith('.pdf'));
  // Conflicting saves never replace another person's version.
  await page.evaluate(()=>testState.conflict=true);await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('#profile-save-status').getByText('This profile changed in another window, or your access changed. Copy your unsaved text before reloading.',{exact:true}).waitFor();await page.evaluate(()=>testState.conflict=false);
  for(const tab of ['Audition Profile','Volunteer','Creative Team','Headshots']){await page.getByRole('tab',{name:tab,exact:true}).click();for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+tab+width);if(width===1280)await page.screenshot({path:'/tmp/bts-profile-editor-'+tab.replaceAll(' ','-')+'.png',fullPage:true});}}
  await page.getByRole('tab',{name:'Volunteer',exact:true}).click();await page.getByRole('button',{name:'Preview profile',exact:true}).click();assert.ok(await page.locator('#profile-preview').textContent().then(t=>t.includes('Synthetic Circus')));
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await page.evaluate(()=>testState.denied=true);await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('#profile-save-status').getByText('You no longer have permission to edit this profile. Your changes have not been saved.',{exact:true}).waitFor();
  await page.goto('http://bts.test/member/profiles/own/edit?denied=1');await page.locator('#profile-load-status').getByText('This profile is not available to edit with your account.',{exact:true}).waitFor();assert.equal(await page.locator('#profile-form').isVisible(),false);assert.equal(await page.evaluate(()=>testState.reads),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: four tabs, history save/reload, preserved legacy fields, private signed photos, uploads and binding failures, immutable PDF/photo paths, conflicts, revoked edit access, preview and responsive widths. Synthetic data only.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
