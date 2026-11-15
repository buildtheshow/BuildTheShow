const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function load(page, auth) {
  const html = read('SYSTEM/Members/Account/' + page + '.html');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(source => source.includes('createClient'));
  const elements = new Map();
  function getElementById(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { value:'', textContent:'', hidden:id === 'reset-form', disabled:false, style:{},
        classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
        addEventListener(event, handler) { this[event] = handler; },
      });
    }
    return elements.get(id);
  }
  vm.runInNewContext(script, {supabase:{createClient:()=>({auth})},document:{getElementById},URL,
    window:{location:{origin:'https://buildtheshow.com',pathname:'/SYSTEM/Members/Account/forgot-password'}}});
  return getElementById;
}
(async () => {
  let destination;
  let node = load('forgot-password',{resetPasswordForEmail:async (email, options)=>{destination=options.redirectTo; return {};} });
  node('email').value = 'synthetic@example.invalid';
  await node('reset-form').submit({preventDefault(){}});
  assert.equal(destination,'https://buildtheshow.com/reset-password','Legacy page URLs must not become recovery destinations.');
  node = load('forgot-password',{resetPasswordForEmail:async ()=>{throw new Error('offline');}});
  node('email').value = 'synthetic@example.invalid';
  await node('reset-form').submit({preventDefault(){}});
  assert.equal(node('submit-btn').disabled,false);
  assert.match(node('error-msg').textContent,/could not send/);

  let updates = 0;
  let callback;
  node = load('reset-password',{
    onAuthStateChange:handler=>{callback=handler;},
    getSession:async ()=>({data:{session:null}}),
    updateUser:async ()=>{updates++;return {};},
  });
  await tick();
  assert.equal(node('reset-form').hidden,true);
  await node('reset-form').submit({preventDefault(){}});
  assert.equal(updates,0,'Missing recovery sessions must not attempt a password change.');
  callback('PASSWORD_RECOVERY',{user:{id:'synthetic'}});
  assert.equal(node('reset-form').hidden,false);
  node('password').value = node('confirm').value = 'short';
  await node('reset-form').submit({preventDefault(){}});
  assert.equal(updates,0);
  node('password').value = node('confirm').value = 'Synthetic password 123';
  await node('reset-form').submit({preventDefault(){}});
  assert.equal(updates,1);
  assert.match(node('success-msg').textContent,/Password updated/);

  node = load('reset-password',{
    onAuthStateChange:()=>{},getSession:async ()=>({data:{session:{user:{id:'synthetic'}}}}),
    updateUser:async ()=>{throw new Error('offline');},
  });
  await tick();
  node('password').value = node('confirm').value = 'Synthetic password 123';
  await node('reset-form').submit({preventDefault(){}});
  assert.equal(node('submit-btn').disabled,false);
  assert.match(node('error-msg').textContent,/could not save/);
  const template=read('BACKEND/SupaBase/templates/reset-password.html');
  assert.match(template,/<a href="{{ \.ConfirmationURL }}"[^>]*>Reset my password<\/a>/);
  assert.equal((template.match(/{{ \.ConfirmationURL }}/g)||[]).length,3,'The button and fallback must use the per-message verification URL.');
  console.log('PASS: canonical recovery redirect, missing sessions, password validation, network failures and email action links. No emails sent or real passwords changed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
