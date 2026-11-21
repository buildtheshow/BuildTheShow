const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const code=fs.readFileSync(__dirname+'/../../ASSETS/scripts/account/profile-data.js','utf8');
 const {collectProfile,validateUpload,safeMediaLink}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const original={bio:'Before',sections:{private_extra:{unchanged:true},performer:{resume_url:'private-file',instruments:'Piano'},volunteer:{comfort:{noise:'prefer-not'},skills:{props:'lots'}},creative:{roles:{director:{enabled:true,experience:'Original experience'}}}}};
 const output=collectProfile(original,{'bio':'After','sections.performer.dance_styles':'Tap','sections.creative.portfolio_url':'https://example.invalid/portfolio'},{volunteer:[{title:'Circus production',role:'Props',description:'Repairs',year:'2025'}],creative:[{title:'Dance production',organisation:'Collective',role:'Director',year:'2024',description:'Not a creative-history field'}]});
 assert.equal(original.bio,'Before');assert.equal(original.sections.performer.dance_styles,undefined);
 assert.equal(output.sections.performer.resume_url,'private-file');assert.equal(output.sections.performer.instruments,'Piano');assert.deepEqual(output.sections.volunteer.skills,{props:'lots'});assert.deepEqual(output.sections.volunteer.comfort,{noise:'prefer-not'});assert.equal(output.sections.creative.roles.director.experience,'Original experience');assert.equal(output.sections.private_extra.unchanged,true);
 assert.equal(output.sections.volunteer.history[0].description,'Repairs');assert.equal(output.sections.creative.history[0].description,undefined);
 assert.throws(()=>collectProfile(original,{}, {volunteer:[{title:'Missing role'}]}),/production title and role/);
 assert.throws(()=>safeMediaLink('javascript:alert(1)'),/https/);assert.throws(()=>safeMediaLink('https://user:password@example.invalid'),/https/);assert.equal(safeMediaLink(''),'');
 assert.equal(validateUpload({size:200,type:'image/png'},'photo'),'png');assert.throws(()=>validateUpload({size:200,type:'text/html'},'photo'),/JPG/);assert.throws(()=>validateUpload({size:6*1024*1024,type:'application/pdf'},'resume'),/under 5 MB/);
 assert.deepEqual(collectProfile({sections:null},{bio:'First production'},{}).sections,{volunteer:{history:[]},creative:{history:[]}});
 console.log('PASS: profile data round-trip preserves legacy/private fields, separates histories, validates media links and upload types/limits.');
})().catch(error=>{console.error(error);process.exitCode=1;});
