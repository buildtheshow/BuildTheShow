import {validateUpload} from './profile-data.js?v=20261121-profile-editor';
// Initial setup only. The existing full profile editor owns all later detail.
export async function ensureOwnProfile(client){const r=await client.rpc('bts_ensure_own_profile');if(r.error)throw r.error;return r.data;}
function randomId(){if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function mountBasicProfile(client,host,{circleId,onSaved,onError,onBusy=()=>{},user}){
 const form=el('form');form.className='mc-basic-profile';
 const intro=el('p','Add their name, date of birth and a headshot or profile photo. You can complete their full profile later.');form.append(intro);
 function field(label,type){const l=el('label',label),i=el('input');i.type=type;i.required=true;l.append(i);form.append(l);return i;}
 const name=field('Name','text'),dob=field('Date of birth','date'),photo=field('Headshot / profile photo','file');photo.accept='image/jpeg,image/png,image/webp';dob.max=new Date().toISOString().slice(0,10);name.maxLength=240;
 const preview=el('img');preview.className='mc-headshot mc-setup-photo';preview.alt='Selected profile photo';preview.hidden=true;photo.after(preview);
 const ageNote=el('p'),guardian=el('label'),consent=el('input');guardian.className='mc-check';consent.type='checkbox';guardian.append(consent,el('span','I am this person’s parent or legal guardian and can manage their profile.'));guardian.hidden=true;form.append(ageNote,guardian);
 const save=el('button','Create profile');save.type='submit';save.className='mc-primary';form.append(save);host.append(form);
 let uploading=false,objectUrl='',uploaded='',lastFile;
 function age(){if(!dob.value)return null;const d=new Date(dob.value+'T12:00:00'),now=new Date();let years=now.getFullYear()-d.getFullYear();if(now.getMonth()<d.getMonth()||now.getMonth()===d.getMonth()&&now.getDate()<d.getDate())years--;return years;}
 dob.onchange=()=>{const years=age(),minor=years!==null&&years<18;guardian.hidden=!minor;consent.required=minor;ageNote.textContent=years===null?'':minor?'Age '+years+'. Updates go to the adult managing this profile.':'Age '+years+'. This adult’s profile will wait for their own permission before it can be used.';};
 photo.onchange=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);uploaded='';lastFile=photo.files[0];preview.hidden=!lastFile;if(lastFile){objectUrl=URL.createObjectURL(lastFile);preview.src=objectUrl;}};
 let requestId=randomId();
 try{const draft=JSON.parse(sessionStorage.getItem('bts_basic_profile_draft')||'null')||user.user_metadata?.additional_profile_draft;if(draft&&((draft.owner_email&&draft.owner_email!==user.email?.toLowerCase())||(draft.created_at&&Date.now()-draft.created_at>7*86400000))){sessionStorage.removeItem('bts_basic_profile_draft');}else if(draft?.first_name||draft?.name)name.value=draft.name||[draft.first_name,draft.last_name].filter(Boolean).join(' ');if(name.value&&draft?.date_of_birth)dob.value=draft.date_of_birth;dob.onchange();}catch{}
 form.onsubmit=async e=>{e.preventDefault();if(uploading||!form.reportValidity())return;uploading=true;onBusy(true);save.disabled=true;save.textContent='Creating profile…';try{
  const file=photo.files[0],extension=validateUpload(file,'photo');
  if(!uploaded){const path=user.id+'/profile-'+randomId()+'.'+extension;const result=await client.storage.from('profile-headshots').upload(path,file,{upsert:false,contentType:file.type});if(result.error)throw new Error('Your photo could not upload. Please try again.');uploaded=client.storage.from('profile-headshots').getPublicUrl(path).data.publicUrl;}
  const words=name.value.trim().split(/\s+/);const result=await client.rpc('bts_create_circle_profile',{p_circle_id:circleId,p_profile:{legal_first_name:words[0],legal_last_name:words.slice(1).join(' '),date_of_birth:dob.value,headshot_url:uploaded},p_guardian_confirmed:consent.checked,p_request_id:requestId});if(result.error)throw result.error;
  sessionStorage.removeItem('bts_basic_profile_draft');if(user.user_metadata)delete user.user_metadata.additional_profile_draft;if(objectUrl)URL.revokeObjectURL(objectUrl);await onSaved(result.data);
 }catch(error){onError(error.message||'This profile could not be created. Please try again.');}finally{uploading=false;onBusy(false);save.disabled=false;save.textContent='Create profile';}};
 return {busy:()=>uploading};
}
