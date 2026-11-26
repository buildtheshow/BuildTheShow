const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'SYSTEM/Members/Account/login.html'), 'utf8');
const loginScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .find(source => source.includes('createLoginFetch'));
assert.ok(loginScript, 'the login client script exists');

const elements = new Map();
let submitHandler;
let abortCount = 0;
for (const id of ['error-msg', 'submit-btn', 'keep-signed-in', 'email', 'password', 'login-form']) {
  elements.set(id, {
    value: '',
    checked: false,
    disabled: false,
    textContent: '',
    classList: { add() {}, remove() {} },
    addEventListener(_type, handler) { submitHandler = handler; },
  });
}
elements.get('email').value = 'synthetic@example.invalid';
elements.get('password').value = 'synthetic-password-only';

const window = {
  location: { href: 'https://buildtheshow.com/login', search: '' },
  fetch(_input, init = {}) {
    return new Promise((_resolve, reject) => {
      const rejectOnAbort = () => {
        abortCount += 1;
        reject(init.signal.reason || new DOMException('Aborted', 'AbortError'));
      };
      if (init.signal.aborted) rejectOnAbort();
      else init.signal.addEventListener('abort', rejectOnAbort, { once: true });
    });
  },
};
const localStorage = { getItem: () => 'persistent', setItem() {} };
const sessionStorage = { getItem: () => null, removeItem() {} };
const document = { getElementById: id => elements.get(id) };
const supabase = {
  createClient(_url, _key, options) {
    return {
      auth: {
        async signInWithPassword() {
          try {
            await options.global.fetch('https://tkmaiktxpwqfbgeojbnf.supabase.co/auth/v1/token?grant_type=password', { method: 'POST' });
            return { data: null, error: null };
          } catch (error) {
            return { data: null, error: { message: error.message } };
          }
        },
      },
    };
  },
};
const sandbox = {
  window, localStorage, sessionStorage, document, supabase,
  BTSAuthStorage: { modeKey: 'bts_auth_storage_mode' },
  BTSAccountSecurity: { ensureAdultAccount: async () => true, safeReturnPath: value => value },
  URL, URLSearchParams, Request, AbortController, DOMException,
  setTimeout(callback, delay, ...args) {
    return global.setTimeout(callback, delay === 18000 ? 5 : delay, ...args);
  },
  clearTimeout: global.clearTimeout,
};
vm.runInNewContext(loginScript, sandbox, { filename: 'login.html' });

(async () => {
  const form = elements.get('login-form');
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await submitHandler({ preventDefault() {} });
    assert.equal(elements.get('error-msg').textContent, 'The sign-in service did not respond in time. Check your connection and try again.');
    assert.equal(elements.get('submit-btn').disabled, false);
    assert.equal(abortCount, attempt, 'each timed-out auth request is cancelled');
  }
  console.log('PASS: stalled Supabase sign-ins are aborted, the user gets a clear error, and retries work. Synthetic request only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
