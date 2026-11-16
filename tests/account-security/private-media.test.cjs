const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
class Element {hasAttribute(){return false;}querySelectorAll(){return [];}}
const calls=[];
const context=vm.createContext({URL,Map,Set,WeakMap,Element,Date,console,alert(){},location:{origin:'https://buildtheshow.com'},document:{documentElement:new Element()},MutationObserver:class{observe(){}},window:{fetch:async value=>({value}),open:value=>({location:{replace(){}},close(){}})},testClient:{storage:{from:bucket=>({createSignedUrl:async(path,seconds)=>{calls.push({bucket,path,seconds});return path.includes('denied')?{error:{message:'denied'}}:{data:{signedUrl:'https://signed.example.invalid/'+bucket+'/'+path}};}})}}});
vm.runInContext(fs.readFileSync(__dirname+'/../../SHARED/Components/private-profile-media.js','utf8'),context);
vm.runInContext('clientPromise=Promise.resolve(testClient)',context);
(async()=>{
 assert.equal(vm.runInContext("privateFile('https://evil.example.invalid/storage/v1/object/public/receipts/file.pdf')",context),null);
 const url='https://tkmaiktxpwqfbgeojbnf.supabase.co/storage/v1/object/public/receipts/own/receipt.pdf';
 const signed=await context.window.BTSPrivateMedia.authorisedUrl(url);assert.ok(signed.startsWith('https://signed.example.invalid/receipts/'));
 assert.equal(calls[0].seconds,300);assert.equal(calls[0].path,'own/receipt.pdf');
 await context.window.BTSPrivateMedia.authorisedUrl(url);assert.equal(calls.length,1);
 assert.equal((await context.window.fetch(url)).value,signed);
 await assert.rejects(context.window.BTSPrivateMedia.authorisedUrl(url.replace('receipt.pdf','denied.pdf')),/does not have access/);
 assert.equal(await context.window.BTSPrivateMedia.authorisedUrl('https://example.invalid/public.pdf'),'https://example.invalid/public.pdf');
 console.log('PASS: private-file links and downloads require authorised short-lived URLs; denied files and external hosts cannot bypass signing.');
})().catch(error=>{console.error(error);process.exitCode=1;});
