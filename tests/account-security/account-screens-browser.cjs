const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.testCalls=[];const state=new URLSearchParams(location.search).get('state');
  window.testClient={auth:{getUser:async()=>({data:{user:state==='signedout'?null:{id:'synthetic-adult'}}}),signOut:async()=>({})},rpc:async(name,args)=>{
   window.testCalls.push({name,args});
   if(name==='bts_get_account_status')return {data:{email_verified:state!=='unverified',active:state==='active'||!location.pathname.includes('/confirm'),status:state==='underage'?'underage':state==='closed'?'closed':'needs_confirmation'}};
   if(name==='bts_confirm_adult_account')return state==='save-error'?{error:{message:'Synthetic server detail'}}:{data:{ok:true}};
   if(name==='bts_preview_ownership_transfer')return {data:{organisation_name:'Synthetic organisation',can_accept:state!=='wrong-recipient'}};
   if(name==='bts_accept_ownership_transfer')return {data:{slug:'synthetic-organisation'}};
   if(name==='bts_production_from_link')return {data:null};return {data:{}};
  }};
 });
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase'))return route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>window.testClient}'});
  if(url.origin!=='http://bts.test')return route.abort();if(url.pathname==='/ASSETS/scripts/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase=window.testClient;'});
  if(['/home','/login','/org/dashboard'].includes(url.pathname))return route.fulfill({contentType:'text/html',body:'<p>Synthetic destination</p>'});
  const filePath=url.pathname==='/member/account/confirm'?'/PUBLIC/confirm-account.html':url.pathname==='/member/account/transfer'?'/PUBLIC/transfer-ownership.html':url.pathname==='/account-entry'?'/PUBLIC/account-entry.html':url.pathname;
  const file=path.resolve(root,'.'+filePath);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(file)});
 });
 async function checkAppearance(name){
  for(const width of [320,768,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow '+width);assert.equal(await page.locator('.auth-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');}
  assert.ok(await page.locator('.nav-logo-img').evaluate(image=>image.complete&&image.naturalWidth>0));
  await page.screenshot({path:'/tmp/bts-account-'+name+'.png',fullPage:true});
 }
 await page.goto('http://bts.test/member/account/confirm?return=%2Fhome');await page.locator('#confirm-form').waitFor({state:'visible'});await checkAppearance('confirm');
 await page.locator('#account-dob').fill('2015-01-01');await page.locator('#confirm-privacy').check();await page.locator('#confirm-terms').check();await page.locator('#confirm-submit').click();assert.equal(await page.evaluate(()=>testCalls.filter(c=>c.name==='bts_confirm_adult_account').length),0);
 await page.locator('#account-dob').fill('1990-01-01');await page.locator('#confirm-submit').click();await page.waitForURL('http://bts.test/home');
 for(const state of ['underage','closed','unverified']){await page.goto('http://bts.test/member/account/confirm?state='+state);await page.waitForFunction(()=>document.getElementById('account-message').textContent!=='Checking your account...');assert.equal(await page.locator('#confirm-form').isVisible(),false);}
 await page.goto('http://bts.test/member/account/confirm?state=active&return=%2Factivities');await page.waitForURL('http://bts.test/activities');
 await page.goto('http://bts.test/member/account/confirm?state=save-error');await page.locator('#account-dob').fill('1990-01-01');await page.locator('#confirm-privacy').check();await page.locator('#confirm-terms').check();await page.locator('#confirm-submit').click();await page.getByText('We could not save your details. Try again. Your entries are still here.',{exact:true}).waitFor();assert.equal(await page.locator('#account-dob').inputValue(),'1990-01-01');
 await page.goto('http://bts.test/member/account/transfer?token=synthetic');await page.locator('#transfer-form').waitFor({state:'visible'});await checkAppearance('ownership');
 await page.locator('#accept-transfer').click();assert.equal(await page.evaluate(()=>testCalls.filter(c=>c.name==='bts_accept_ownership_transfer').length),0);await page.locator('#accept-responsibility').check();await page.locator('#accept-transfer').click();await page.getByRole('link',{name:'Open organisation',exact:true}).waitFor();assert.equal(await page.locator('#transfer-form').isVisible(),false);
 await page.goto('http://bts.test/member/account/transfer?token=synthetic&state=wrong-recipient');await page.getByText('Log in with the account the invitation was sent to.',{exact:false}).waitFor();assert.equal(await page.locator('#transfer-form').isVisible(),false);
 await page.goto('http://bts.test/account-entry');await page.getByText('This show link is not available.',{exact:false}).waitFor();await checkAppearance('old-link');
 assert.deepEqual(errors,[]);console.log('PASS: shared branded confirmation/ownership/old-link screens at 320/768/1280 widths; adult and email restrictions, explicit consent, preserved returns, recipient binding and retained entries. Synthetic APIs only; no real account changed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
