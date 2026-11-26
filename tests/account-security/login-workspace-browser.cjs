const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const variant = new URLSearchParams(location.search).get('fixture');
      window.testCalls = [];
      if (variant === 'timeout') {
        const nativeSetTimeout = window.setTimeout.bind(window);
        window.setTimeout = (callback, delay, ...args) => nativeSetTimeout(callback, delay === 18000 ? 20 : delay, ...args);
        window.loginFetchAborted = 0;
        window.fetch = (_input, init = {}) => new Promise((resolve, reject) => {
          const abort = () => { window.loginFetchAborted += 1; reject(init.signal.reason || new DOMException('Aborted', 'AbortError')); };
          if (init.signal.aborted) abort();
          else init.signal.addEventListener('abort', abort, {once: true});
        });
      }
      window.supabase = {createClient: (_url, _key, options = {}) => ({
        auth: {signInWithPassword: async () => {
          if (variant === 'offline') return {data:null,error:{message:'Synthetic connection failure'}};
          if (variant === 'timeout') {
            try {
              await options.global.fetch('https://tkmaiktxpwqfbgeojbnf.supabase.co/auth/v1/token?grant_type=password', {method:'POST'});
              return {data: null, error: null};
            } catch (error) { return {data: null, error: {message: error.message}}; }
          }
          return {data: {user: {id: 'synthetic-adult', user_metadata: {account_type: 'organization'}}}};
        }},
        rpc: async (name, args) => {
          window.testCalls.push({name, args});
          if (name === 'bts_get_account_status') return {data: {active: true}};
          if (variant === 'offline') return {error: {message: 'Synthetic connection failure'}};
          return {data: {
            organisations: variant === 'owner' ? [{id: 'org', access: 'owner'}] : variant === 'admin' ? [{id: 'org', access: 'admin'}] : variant === 'viewer' ? [{id: 'org', access: 'viewer'}] : [],
            management: variant === 'staff' ? [{id: 'production', team_member_id: 'accepted-team'}] : []
          }};
        }
      })};
      if (variant === 'stored') sessionStorage.setItem('bts_return_after_auth', '/activities?tab=shifts');
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('supabase')) return route.fulfill({contentType: 'text/javascript', body: ''});
      if (url.origin !== 'http://bts.test') return route.abort();
      if (url.pathname === '/login') return route.fulfill({contentType: 'text/html', body: fs.readFileSync(path.join(root, 'SYSTEM/Members/Account/login.html'))});
      if (url.pathname.startsWith('/org') || url.pathname === '/member/home' || url.pathname === '/home' || url.pathname === '/activities' || url.pathname === '/invite') return route.fulfill({contentType: 'text/html', body: '<p>Synthetic destination</p>'});
      if (url.pathname.includes('private-profile-media.js')) return route.fulfill({contentType: 'text/javascript', body: ''});
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({status: 404, body: ''});
      return route.fulfill({contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream', body: fs.readFileSync(file)});
    });
    const cases = [
      ['owner', '', '/member/home'], ['admin', '', '/member/home'], ['staff', '', '/member/home'],
      ['member', '', '/member/home'], ['viewer', '', '/member/home'],
      ['owner', '&return=%2Fhome', '/home'], ['owner', '&return=%2Factivities%3Ftab%3Dshifts', '/activities?tab=shifts'],
      ['owner', '&invite=synthetic-invitation', '/invite?token=synthetic-invitation'],
      ['stored', '', '/activities?tab=shifts']
    ];
    for (const [variant, query, destination] of cases) {
      await page.goto('http://bts.test/login?fixture=' + variant + query);
      await page.locator('#email').fill('synthetic@example.invalid');
      await page.locator('#password').fill('synthetic-password-only');
      await page.locator('#submit-btn').click();
      await page.waitForURL('http://bts.test' + destination);
      assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, destination);
    }
    await page.goto('http://bts.test/login?fixture=offline');
    await page.locator('#email').fill('synthetic@example.invalid');
    await page.locator('#password').fill('synthetic-password-only');
    await page.locator('#submit-btn').click();
    await page.getByText('Synthetic connection failure', {exact: true}).waitFor();
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(await page.locator('#submit-btn').isEnabled(), true);
    await page.goto('http://bts.test/login?fixture=timeout');
    await page.locator('#email').fill('synthetic@example.invalid');
    await page.locator('#password').fill('synthetic-password-only');
    await page.locator('#submit-btn').click();
    await page.getByText('The sign-in service did not respond in time. Check your connection and try again.', {exact: true}).waitFor();
    assert.equal(await page.evaluate(() => window.loginFetchAborted), 1);
    assert.equal(await page.locator('#submit-btn').isEnabled(), true);
    await page.locator('#submit-btn').click();
    await page.getByText('The sign-in service did not respond in time. Check your connection and try again.', {exact: true}).waitFor();
    assert.equal(await page.evaluate(() => window.loginFetchAborted), 2, 'a timed-out auth request is aborted so another attempt can start');
    assert.deepEqual(errors, []);
    console.log('PASS: ordinary login opens Home for owners/admins/staff/members/viewers; explicit returns and invitations are preserved; sign-in errors remain visible; hung auth fetches abort and retries remain available. Synthetic sign-ins only.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
