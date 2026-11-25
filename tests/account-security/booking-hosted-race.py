"""Opt-in hosted concurrency proof using disposable, named synthetic fixtures.
Run only after the migration passes a rollback rehearsal. No emails are sent: fixture
outbox jobs are deleted inside each winning transaction before they become visible.
"""
import argparse,json,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--run-hosted',action='store_true');args=parser.parse_args()
if not args.run_hosted:parser.error('Explicit --run-hosted is required; this temporarily creates synthetic hosted fixtures.')
if (ROOT/'supabase/.temp/project-ref').read_text().strip()!='tkmaiktxpwqfbgeojbnf':raise SystemExit('Unexpected linked project.')
work=Path(tempfile.mkdtemp(prefix='bts-booking-race-'))
users=['1f7c169f-c707-48d2-97bb-749c5ca382a0','4180925a-80f5-443d-aed7-9792e5e96172','3f6513e6-1dfc-48ae-991f-e889305bb4d6','131ad1e8-23b0-4756-81ce-bf59302e4b4f']
user_list=','.join("'"+u+"'" for u in users)
prod='fdb2ec7b-a107-41e6-b960-7e6b89e8ca96';other='8efb6463-9c50-444f-9305-be2c83d12ce4';session='ef072543-8703-49a6-90d7-6f14ed5a2b41';slot='03f1a8af-1b48-4a55-ab10-9ced63588dda'
purge_jobs=f"DELETE FROM bts_private.family_mail WHERE actor_id IN({user_list}) OR profile_id IN(SELECT id FROM public.profiles WHERE user_id IN({user_list})) OR payload->>'production_id'='{prod}';"
def file(name,sql):
 p=work/(name+'.sql');p.write_text(sql);return p
def run(name,sql):
 p=file(name,sql);result=subprocess.run(['supabase','db','query','--linked','--file',str(p)],cwd=ROOT,text=True,capture_output=True);(work/(name+'.stdout')).write_text(result.stdout);(work/(name+'.stderr')).write_text(result.stderr)
 if result.returncode:raise RuntimeError(name+' failed; inspect '+str(work))
 return json.loads(result.stdout).get('rows',[])
def race(name,sqls):
 jobs=[]
 for i,sql in enumerate(sqls):
  p=file(name+str(i),sql);jobs.append(subprocess.Popen(['supabase','db','query','--linked','--file',str(p)],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE))
 results=[]
 for i,job in enumerate(jobs):
  out,err=job.communicate(timeout=60);(work/(name+str(i)+'.stdout')).write_text(out);(work/(name+str(i)+'.stderr')).write_text(err);results.append((job.returncode,err))
 if sum(code==0 for code,_ in results)!=1:raise RuntimeError(name+' did not have exactly one winner; inspect '+str(work))
 if not any('full or reserved' in err or 'just filled or reserved' in err for code,err in results if code):raise RuntimeError(name+' loser was not rejected for capacity; inspect '+str(work))
 print('PASS:',name,'— one winner, one capacity rejection.')
def identity(user):return "SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','"+json.dumps({'sub':user,'role':'authenticated'})+"',true);"
pre=run('preflight',f"SELECT (SELECT count(*) FROM auth.users WHERE id IN({user_list})) AS fixture_accounts,(SELECT count(*) FROM public.productions WHERE id IN('{prod}','{other}')) AS fixture_productions;")[0]
if any(pre.values()):raise SystemExit('Fixture IDs already exist; refusing to modify them.')
seed=(ROOT/'tests/account-security/team-fixtures.sql').read_text().split('CREATE TEMP TABLE team_test_tokens')[0]
setup=f"BEGIN;{seed} UPDATE public.productions SET page_status='hidden' WHERE id='{prod}';INSERT INTO public.audition_sessions(id,production_id,name,enabled,show_to_applicants) VALUES('{session}','{prod}','Disposable concurrency audition',true,true);INSERT INTO public.audition_time_slots(id,session_id,slot_time,capacity) VALUES('{slot}','{session}','10:00',1);{purge_jobs}COMMIT;"
created=False
try:
 run('setup',setup);created=True
 race('concurrent-reservations',[f"BEGIN;{identity(user)}SELECT public.bts_audition_hold('acquire','{slot}');SELECT pg_sleep(1);COMMIT;" for user in users[1:3]])
 run('clear-test-holds',f"DELETE FROM bts_private.audition_holds WHERE user_id IN({user_list});")
 queries=[]
 for i,user in enumerate(users[1:3]):
  request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa'+str(i)
  queries.append(f"""BEGIN;{identity(user)}
DO $race$ DECLARE profile uuid;payload jsonb;BEGIN
 profile:=public.bts_save_profile(jsonb_build_object('credit_name','Disposable adult {i}','date_of_birth','1990-01-01','relationship_kind','self'),NULL,false);
 payload:=jsonb_build_object('production_id','{prod}','session_id','{session}','slot_id','{slot}','profile_id',profile,'name','Disposable adult {i}','email','synthetic@example.invalid','custom_answers',jsonb_build_object('Date of Birth','1990-01-01'));
 PERFORM public.bts_confirm_audition('{request}',payload,payload);
END $race$;RESET ROLE;{purge_jobs}SELECT pg_sleep(1);COMMIT;""")
 race('concurrent-confirmations',queries)
 result=run('assert-race-counts',f"SELECT (SELECT count(*) FROM public.audition_bookings WHERE production_id='{prod}') AS bookings,(SELECT booked_count FROM public.bts_public_audition_availability('{prod}') WHERE slot_id='{slot}') AS occupancy,(SELECT count(*) FROM bts_private.family_mail WHERE actor_id IN({user_list}) OR payload->>'production_id'='{prod}') AS visible_test_mail;")[0]
 if result!={'bookings':1,'occupancy':1,'visible_test_mail':0}:raise RuntimeError('Unexpected race counts: '+str(result))
 print('PASS: exactly one booking/occupied place; zero visible test email jobs.')
finally:
 if created:
  cleanup=f"""BEGIN;
{purge_jobs}
DELETE FROM bts_private.family_audit WHERE actor_id IN({user_list}) OR profile_id IN(SELECT id FROM public.profiles WHERE user_id IN({user_list}));
DELETE FROM public.audition_bookings WHERE production_id IN('{prod}','{other}');
DELETE FROM public.audition_applications WHERE production_id IN('{prod}','{other}');
DELETE FROM public.production_team_members WHERE production_id IN('{prod}','{other}');
DELETE FROM public.audition_time_slots WHERE session_id='{session}';
DELETE FROM public.audition_sessions WHERE production_id IN('{prod}','{other}');
DELETE FROM public.productions WHERE id IN('{prod}','{other}');
DELETE FROM public.organizations WHERE id='432b1ee2-515d-4637-9f8f-c733fd21f219' AND admin_id='{users[0]}';
DELETE FROM bts_private.profile_contacts WHERE profile_id IN(SELECT id FROM public.profiles WHERE user_id IN({user_list}));
DELETE FROM bts_private.profile_keys WHERE profile_id IN(SELECT id FROM public.profiles WHERE user_id IN({user_list}));
DELETE FROM bts_private.profile_controls WHERE profile_id IN(SELECT id FROM public.profiles WHERE user_id IN({user_list}));
DELETE FROM public.profiles WHERE user_id IN({user_list});
DELETE FROM bts_private.audition_holds WHERE user_id IN({user_list});
DELETE FROM bts_private.email_rate_windows WHERE user_id IN({user_list});
DELETE FROM auth.users WHERE id IN({user_list});
COMMIT;SELECT count(*) AS fixture_accounts FROM auth.users WHERE id IN({user_list});"""
  result=run('cleanup',cleanup)
  if result[-1]['fixture_accounts']!=0:raise RuntimeError('Synthetic fixture cleanup incomplete.')
  print('PASS: all hosted synthetic accounts and production records removed.')
print('Sanitised race results recorded; no real emails sent. Temporary evidence:',work)
