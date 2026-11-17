const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
async function route(file) {
  return import('data:text/javascript;base64,' + fs.readFileSync(path.join(root, file)).toString('base64'));
}
(async () => {
  const settings = await route('functions/member/settings.js');
  const login = await route('functions/login.js');
  const signup = await route('functions/signup.js');
  const households = await route('functions/member/households.js');
  const legacy = await route('functions/SYSTEM/[[path]].js');
  const original = 'https://bts.test/member/settings?panel=profile&return=%2Factivities';
  let fetched;
  const response = await settings.onRequest({request: new Request(original), env: {ASSETS: {fetch: async input => {
    assert.ok(input instanceof URL, 'Use the established asset URL fetch, not a copied incoming request.');
    fetched = input.href;
    return new Response('<main>Settings fixture</main>', {headers: {'Content-Type': 'text/html'}});
  }}}});
  assert.equal(fetched, 'https://bts.test/SYSTEM/Members/Performer/performer-settings.html');
  assert.equal(response.status, 200); assert.equal(response.headers.get('Location'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(await response.text(), '<main>Settings fixture</main>');
  for (const pathname of ['Members/Performer/performer-settings', 'Members/Performer/performer-settings.html', 'members/performer/performer-settings']) {
    const redirected = await legacy.onRequest({request: new Request('https://bts.test/SYSTEM/' + pathname + '?panel=profile&return=%2Factivities'), params: {path: pathname.split('/')}});
    assert.equal(redirected.status, 302);
    assert.equal(redirected.headers.get('Location'), original);
    assert.equal(redirected.headers.get('Cache-Control'), 'no-store');
  }
  const loginResponse = await login.onRequest({request: new Request('https://bts.test/login?return=%2Factivities'), env: {ASSETS: {fetch: async input => {
    assert.ok(input instanceof URL);
    assert.equal(input.href, 'https://bts.test/SYSTEM/Members/Account/login.html');
    return new Response('<main>Login fixture</main>');
  }}}});
  assert.equal(loginResponse.status, 200); assert.equal(loginResponse.headers.get('Location'), null);
  assert.equal(loginResponse.headers.get('Cache-Control'), 'no-store');
  const extensionlessLogin = await legacy.onRequest({request: new Request('https://bts.test/SYSTEM/Members/Account/login?return=%2Factivities'), params: {path: ['Members','Account','login']}});
  assert.equal(extensionlessLogin.status, 302); assert.equal(extensionlessLogin.headers.get('Location'), 'https://bts.test/login?return=%2Factivities');
  const signupResponse = await signup.onRequest({request: new Request('https://bts.test/signup?invite=synthetic'), env: {ASSETS: {fetch: async input => {
    assert.ok(input instanceof URL); assert.equal(input.pathname, '/SYSTEM/Members/Account/signup.html'); return new Response('Signup fixture');
  }}}});
  assert.equal(signupResponse.status, 200); assert.equal(signupResponse.headers.get('Location'), null);
  for (const suffix of ['signup', 'signup.html']) {
    const oldSignup = await legacy.onRequest({request: new Request('https://bts.test/SYSTEM/Members/Account/' + suffix + '?invite=synthetic'), params: {path: ['Members', 'Account', suffix]}});
    assert.equal(oldSignup.status, 302); assert.equal(oldSignup.headers.get('Location'), 'https://bts.test/signup?invite=synthetic');
  }
  const householdResponse = await households.onRequest({request: new Request('https://bts.test/member/households'), env: {ASSETS: {fetch: async input => {
    assert.ok(input instanceof URL); assert.equal(input.pathname, '/SYSTEM/Members/Households/households.html'); return new Response('Household fixture');
  }}}});
  assert.equal(householdResponse.status, 200); assert.equal(householdResponse.headers.get('Location'), null);
  const existing = await legacy.onRequest({request: new Request('https://bts.test/SYSTEM/Members/Account/login.html?return=%2Factivities'), params: {path: ['Members','Account','login.html']}});
  assert.equal(existing.status, 302); assert.equal(existing.headers.get('Location'), 'https://bts.test/login?return=%2Factivities');
  console.log('PASS: clean Settings serves HTML directly; both internal URL forms return to /member/settings, preserve query parameters and avoid cached redirects; login also serves directly and both old login forms retain their return destination.');
})().catch(error => {console.error(error); process.exitCode = 1;});
