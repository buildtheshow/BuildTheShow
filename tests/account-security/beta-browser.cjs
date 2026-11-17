const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.testSignupCalls=[];localStorage.setItem('bts_cookie_ok','1');
  window.testClient={auth:{getSession:async()=>({data:{session:null}}),signUp:async input=>{window.testSignupCalls.push(input);
    const variant=new URLSearchParams(location.search).get('case');
    if(variant==='duplicate')return {data:{session:null,user:{identities:[]}},error:null};
    if(variant==='duplicate-error')return {data:{session:null},error:{code:'user_already_exists',status:422,message:'User already registered'}};
    if(variant==='invalid-email')return {data:{session:null},error:{code:'email_address_invalid',status:400,message:'Check your email address and try again.'}};
    return {data:{session:null,user:{identities:[{provider:'email'}]}},error:null};}},rpc:async(name,args)=>({data:name==='bts_check_beta_code'&&args.p_code==='SYNTHETIC-BETA-CODE'})};
 });
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('supabase'))return route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>window.testClient}'});if(url.origin!=='http://bts.test')return route.abort();if(url.pathname==='/ASSETS/scripts/supabase.js')return route.fulfill({contentType:'text/javascript',body:'export const supabase=window.testClient;'});if(url.pathname.includes('private-profile-media.js'))return route.fulfill({contentType:'text/javascript',body:''});const pathname=url.pathname==='/'?'/index.html':url.pathname==='/signup'?'/SYSTEM/Members/Account/signup.html':url.pathname==='/login'?'/SYSTEM/Members/Account/login.html':url.pathname==='/pricing'?'/PUBLIC/pricing.html':url.pathname;const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream',body:fs.readFileSync(file)});});
 await page.goto('http://bts.test/');await page.locator('.nav-actions .btn--signup,#nav-actions .btn--signup').first().click();
 await page.getByRole('heading',{name:"We're in Beta Testing",exact:true}).waitFor();
 await page.locator('#beta-code').fill('INVALID-BETA');await page.locator('#beta-continue').click();await page.getByText('That code is invalid, expired or fully used.',{exact:false}).waitFor();assert.equal(new URL(page.url()).pathname,'/');
 await page.locator('#beta-code').fill('SYNTHETIC-BETA-CODE');await page.locator('#beta-continue').click();await page.waitForURL('http://bts.test/signup');assert.equal(await page.locator('#beta-code').inputValue(),'SYNTHETIC-BETA-CODE');assert.equal(new URL(page.url()).search,'');
 const purposeGroup=page.getByRole('group',{name:'What are you signing up for?',exact:true});
 assert.equal(await purposeGroup.getByRole('radio').count(),3);
 await page.waitForFunction(()=>[...document.querySelectorAll('.check-option img')].every(image=>image.complete&&image.naturalWidth>0));
 await purposeGroup.locator('input[value="member"]').focus();await page.keyboard.press('ArrowDown');
 assert.equal(await purposeGroup.locator('input[value="household"]').isChecked(),true);
 await purposeGroup.locator('label').first().locator('img').click();assert.equal(await purposeGroup.locator('input[value="organisation"]').isChecked(),true);
 await page.reload();
 for(const width of [320,768,1280]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Signup overflow '+width);
   const appearance=await page.evaluate(()=>{
     const card=document.querySelector('.auth-card'),field=document.querySelector('#email'),button=document.querySelector('#submit-btn');
     const cardStyle=getComputedStyle(card),fieldStyle=getComputedStyle(field),buttonStyle=getComputedStyle(button);
     return {cardColour:cardStyle.backgroundColor,cardRadius:cardStyle.borderRadius,fieldHeight:field.getBoundingClientRect().height,fieldRadius:fieldStyle.borderRadius,buttonColour:buttonStyle.backgroundColor,buttonWidth:button.getBoundingClientRect().width,fieldWidth:field.getBoundingClientRect().width};
   });
   assert.equal(appearance.cardColour,'rgb(255, 255, 255)');assert.equal(appearance.cardRadius,'14px');
   assert.ok(appearance.fieldHeight>=44,'Inputs should retain the designed padded control height');assert.equal(appearance.fieldRadius,'8px');
   assert.equal(appearance.buttonColour,'rgb(87, 46, 136)');assert.ok(Math.abs(appearance.buttonWidth-appearance.fieldWidth)<2,'Submit uses the original full-width form control');
   await page.screenshot({path:'/tmp/bts-signup-restored-'+width+'.png',fullPage:true});
 }
 await page.locator('#first-name').fill('Synthetic');await page.locator('#last-name').fill('Adult');await page.locator('#dob').fill('1990-01-01');await page.locator('#email').fill('synthetic@example.invalid');await page.locator('#password').fill('synthetic-password-only');await page.locator('#consent-privacy').check();await page.locator('#consent-terms').check();
 await page.locator('#submit-btn').click();await page.getByText('Choose Organisation, Member or Household to continue.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>testSignupCalls.length),0);
 await page.locator('input[name="signup-purpose"][value="member"]').check();
 await page.locator('#beta-code').fill('');await page.locator('#submit-btn').click();await page.getByText('Enter a valid beta invitation code to sign up.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>testSignupCalls.length),0);
 await page.locator('#beta-code').fill('SYNTHETIC-BETA-CODE');await page.locator('#submit-btn').click();await page.getByRole('heading',{name:'Check your inbox',exact:true}).waitFor();assert.equal(await page.evaluate(()=>testSignupCalls[0].options.data.beta_code),'SYNTHETIC-BETA-CODE');assert.equal(await page.evaluate(()=>sessionStorage.getItem('bts_beta_code')),null);
 assert.equal(await page.locator('#signup-form').isVisible(),false);assert.equal(await page.locator('#signup-footer').isVisible(),false);
 assert.equal(await page.locator('#error-msg').isVisible(),false);assert.equal(await page.locator('#signup-confirmation').isVisible(),true);
 assert.equal(await page.locator('#password').inputValue(),'');
 assert.equal(await page.locator('#signup-title').evaluate(element=>document.activeElement===element),true);
 await page.getByText('Not there? Check your junk or spam folder.',{exact:true}).waitFor();
 await page.getByText('Signed up before? Log in instead.',{exact:true}).waitFor();
 assert.equal(await page.locator('#signup-confirmation').getByRole('link',{name:'Forgot your password?',exact:true}).getAttribute('href'),'/forgot-password');
 assert.ok(await page.locator('#signup-title').evaluate(element=>{const bounds=element.getBoundingClientRect();return bounds.top>=0&&bounds.bottom<=innerHeight;}));
 assert.equal(await page.locator('#signup-confirmation-login').getAttribute('href'),'/login?return=%2Fmember%2Fhome');
 await page.screenshot({path:'/tmp/bts-signup-confirmation-desktop.png',fullPage:true});
 await page.setViewportSize({width:320,height:900});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await page.locator('#signup-title').evaluate(element=>{const bounds=element.getBoundingClientRect();return bounds.top>=0&&bounds.bottom<=innerHeight;}));
 await page.screenshot({path:'/tmp/bts-signup-confirmation-phone.png',fullPage:true});

 // Each purpose selects its own setup route without becoming an access role.
 for (const [purpose, destination] of [['organisation','/org/setup'],['member','/member/home'],['household','/member/households']]) {
   await page.goto('http://bts.test/signup');
   await page.locator('input[name="signup-purpose"][value="'+purpose+'"]').check();await page.locator('#beta-code').fill('SYNTHETIC-BETA-CODE');
   await page.locator('#first-name').fill('Synthetic');await page.locator('#last-name').fill('Adult');await page.locator('#dob').fill('1990-01-01');await page.locator('#email').fill('synthetic@example.invalid');await page.locator('#password').fill('synthetic-password-only');await page.locator('#consent-privacy').check();await page.locator('#consent-terms').check();
   await page.locator('#submit-btn').click();await page.getByRole('heading',{name:'Check your inbox',exact:true}).waitFor();
   const signup=await page.evaluate(()=>testSignupCalls[0]);
   assert.equal(signup.options.data.signup_purpose,purpose);assert.equal(signup.options.data.account_type,undefined);
   assert.equal(new URL(signup.options.emailRedirectTo).searchParams.get('return'),destination);
   assert.equal(await page.locator('#signup-confirmation-login').getAttribute('href'),'/login?return='+encodeURIComponent(destination));
   assert.equal(await page.locator('#signup-form').isVisible(),false);
 }
 // Existing users never see a false new-registration confirmation.
 for(const variant of ['duplicate','duplicate-error','invalid-email']) {
   await page.goto('http://bts.test/signup?case='+variant+'&return=%2Factivities');
   await page.locator('input[name="signup-purpose"][value="member"]').check();await page.locator('#beta-code').fill('SYNTHETIC-BETA-CODE');
   await page.locator('#first-name').fill('Synthetic');await page.locator('#last-name').fill('Adult');await page.locator('#dob').fill('1990-01-01');await page.locator('#email').fill('synthetic@example.invalid');await page.locator('#password').fill('synthetic-password-only');await page.locator('#consent-privacy').check();await page.locator('#consent-terms').check();
   await page.locator('#submit-btn').click();
   const message=variant==='invalid-email'?'Check your email address and try again.':'That email already has an account. Log in or reset your password.';
   await page.locator('#error-msg').getByText(message,{exact:false}).waitFor();
   assert.equal(await page.locator('#signup-form').isVisible(),true);assert.equal(await page.locator('#signup-confirmation').isVisible(),false);
   assert.equal(await page.locator('#email').inputValue(),'synthetic@example.invalid');assert.equal(await page.locator('#beta-code').inputValue(),'SYNTHETIC-BETA-CODE');assert.equal(await page.locator('#submit-btn').isEnabled(),true);
   if(variant!=='invalid-email'){
     assert.equal(await page.locator('#error-msg').getByRole('link',{name:'Log In',exact:true}).getAttribute('href'),'/login?return=%2Factivities');
     assert.equal(await page.locator('#error-msg').getByRole('link',{name:'Reset password',exact:true}).getAttribute('href'),'/forgot-password');
   }
 }
 // Every public signup entrance shares the same live beta form.
 for (const entry of ['/login?return=%2Factivities&invite=synthetic', '/pricing']) {
   await page.goto('http://bts.test'+entry);
   await page.locator('a.btn--signup').first().click();
   await page.getByRole('heading',{name:"We're in Beta Testing",exact:true}).waitFor();
   await page.locator('#beta-code').fill('SYNTHETIC-BETA-CODE');await page.locator('#beta-continue').click();
   await page.waitForURL('http://bts.test/signup'+(entry.startsWith('/login')?'?return=%2Factivities&invite=synthetic':''));
   assert.equal(await page.locator('#beta-code').inputValue(),'SYNTHETIC-BETA-CODE');
 }
 await page.goto('http://bts.test/login');await page.getByRole('link',{name:'Sign up',exact:true}).click();await page.getByRole('heading',{name:"We're in Beta Testing",exact:true}).waitFor();
 await page.screenshot({path:'/tmp/bts-beta-popup-login.png',fullPage:false});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#beta-signup-overlay').isVisible(),false);
 await page.goto('http://bts.test/pricing');await page.getByRole('link',{name:'Get Started Free',exact:true}).click();await page.getByRole('heading',{name:"We're in Beta Testing",exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: home, login and pricing signup entrances share one beta popup; footer/CTA links and invitation returns work; existing home popup accepts beta code, rejects invalid codes, carries code privately to clean signup, requires code on direct form, preserves adult consent and email verification, and fits mobile widths; all existing icons load, icon labels select the radio, and arrow-key navigation works. Synthetic APIs only; no account or email created.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
