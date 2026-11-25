// Actual existing wizard and HTML; synthetic providers only, no production login or email.
const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.fixtureCalls=[];window.confirmAttempts=0;window.savedReceipt=null;
 const profile={id:'11111111-1111-4111-8111-111111111111',name:'Fixture child',credit_name:'Fixture child',legal_first_name:'Fixture',legal_last_name:'Child',date_of_birth:'2015-01-01',can_manage:true,kind:'child',state:'active'};
 const result={booking_id:'saved-booking',application_id:'saved-application',booking_ids:['saved-booking'],headshot_url:'https://example.invalid/private-fixture.jpg',profile_id:profile.id};
 window.fixtureClient={auth:{getUser:async()=>({data:{user:{id:'adult',email:'adult@example.invalid'}}}),getSession:async()=>({data:{session:{user:{id:'adult'}}}})},rpc:async(name,args)=>{window.fixtureCalls.push({name,args});
 if(name==='bts_get_account_status')return {data:{active:true}};
 if(name==='bts_family')return {data:{profiles:[profile],households:[],invites:[],reviews:[]}};
 if(name==='bts_profile_access')return {data:true};
 if(name==='bts_audition_receipt')return {data:window.savedReceipt};
 if(name==='bts_audition_hold'){
  if(args.p_action==='check'&&(window.expiredCheck||window.savedReceipt))return {error:{code:'P0001',message:'Your reservation expired. Choose an available time again.'}};
  return {data:args.p_action==='release'?{released:true}:{id:'33333333-3333-4333-8333-333333333333',slot_id:args.p_slot_id,expires_at:new Date(Date.now()+900000).toISOString(),extended:false}};
 }
 if(name==='bts_confirm_audition'){
  window.confirmAttempts++;
  if(window.confirmAttempts===1)return {error:{code:'P0001',message:'This audition time is full or reserved. Choose another available time.'}};
  if(window.confirmAttempts===2){window.savedReceipt=result;return {error:{message:'Synthetic lost HTTP response'}};}
  return {data:{...result,replayed:true}};
 }
 return {data:[]};},from:table=>{const q={select(){return this},eq(){return this},is(){return this},order(){return this},limit(){return this},or(){return this},maybeSingle:async()=>({data:null}),single:async()=>({data:null}),then(resolve){resolve({data:table==='profiles'?[profile]:[]});},insert(){throw Error('Browser attempted a separate insert')},update(){throw Error('Browser attempted a raw slot or split record update')}};return q;},channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}}),removeChannel(){}};
});
await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase'))return route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>window.fixtureClient};'});if(url.origin!=='http://bts.test')return route.abort();if(url.pathname==='/ASSETS/scripts/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase=window.fixtureClient;'});if(url.pathname.includes('private-profile-media.js'))return route.fulfill({contentType:'text/javascript',body:''});const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});let body=fs.readFileSync(file);if(url.pathname.endsWith('/audition-info.html'))body=body.toString().replace('      loadPage();','      /* Production state supplied by the isolated test. */');return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html',body});});
async function open(){await page.goto('http://bts.test/SYSTEM/Public/audition-info.html');await page.waitForFunction(()=>typeof openBookModal==='function');await page.evaluate(async()=>{
 const session='22222222-2222-4222-8222-222222222222',slot='44444444-4444-4444-8444-444444444444';
 _bkProd={id:'55555555-5555-4555-8555-555555555555',title:'Synthetic audition',is_public:true,page_status:'live'};_allSessions=[{id:session,name:'General audition',type:'audition',format:'in_person',date:'2026-12-01'}];_allSlots={[session]:[{id:slot,session_id:session,slot_time:'10:00',capacity:1}]};selectedSlots[session]=slot;
 await openBookModal(session);Object.assign(_bkState,{perf_fname:'Fixture',perf_lname:'Child',perf_birthday:'2015-01-01',perf_age:11,is_minor:true,guardian_name:'Fixture adult',guardian_email:'adult@example.invalid',guardian_ack:true,ct_fname:'Fixture',ct_lname:'Adult',ct_email:'adult@example.invalid',headshot_url:'https://example.invalid/private-fixture.jpg'});
 });await page.locator('#bts-family-performer').selectOption('11111111-1111-4111-8111-111111111111');await page.evaluate(()=>_bkGoTo(6));}
await open();await page.locator('#bk-timer-display').getByText(/Slot held/).waitFor();
await page.evaluate(()=>_bkSubmit());assert.equal(await page.locator('#bk-success.active').count(),0);await page.getByText(/Booking failed: This audition time is full/).waitFor();
await page.evaluate(()=>_bkSubmit());assert.equal(await page.locator('#bk-success.active').count(),0);await page.getByText(/Synthetic lost HTTP response/).waitFor();
const checksBefore=await page.evaluate(()=>fixtureCalls.filter(c=>c.name==='bts_audition_hold'&&c.args.p_action==='check').length);
await page.evaluate(()=>_bkSubmit());await page.locator('#bk-success.active').waitFor();await page.getByText('Booking saved. The confirmation email is queued for delivery.',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>fixtureCalls.filter(c=>c.name==='bts_audition_hold'&&c.args.p_action==='check').length),checksBefore,'Saved retry required a consumed hold');
const payload=await page.evaluate(()=>fixtureCalls.find(c=>c.name==='bts_confirm_audition').args);assert.equal(payload.p_booking.profile_id,'11111111-1111-4111-8111-111111111111');assert.equal(payload.p_application.profile_id,payload.p_booking.profile_id);assert.ok(payload.p_request_id);assert.equal(await page.evaluate(()=>new Set(fixtureCalls.filter(c=>c.name==='bts_confirm_audition').map(c=>c.args.p_request_id)).size),1);
await page.screenshot({path:'/tmp/bts-booking-confirmation.png',fullPage:true});
await open();await page.evaluate(async()=>{window.expiredCheck=true;await _bkSubmit();});await page.getByText(/Your reservation expired/).waitFor();assert.equal(await page.locator('#bk-success.active').count(),0);assert.equal(await page.evaluate(()=>_bkState.perf_fname),'Fixture');
assert.deepEqual(errors,[]);console.log('PASS: existing wizard layout, server reservations, final capacity rejection, atomic save call, lost-response retry with the same request ID, consumed-hold recovery, canonical profile, expiry and preserved form data. Synthetic providers only.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
