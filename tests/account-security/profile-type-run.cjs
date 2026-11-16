const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const {unaccent}=require('@electric-sql/pglite/contrib/unaccent');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.resolve(__dirname,file),'utf8');
(async()=>{
 const db=new PGlite({extensions:{pgcrypto,unaccent}});
 try{
  await db.exec('CREATE EXTENSION pgcrypto;');
  await db.exec(read('baseline.sql')+read('team-baseline.sql')+read('admission-baseline.sql')+read('volunteer-baseline.sql')+read('routes-baseline.sql'));
  await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;');
  for(const file of ['20261115103000_account_security_foundation.sql','20261115123000_account_bound_team_access.sql','20261115124500_require_team_session_for_staff_helpers.sql','20261115133000_audition_account_ownership.sql','20261116100000_volunteer_account_ownership.sql','20261116120000_private_record_routes.sql']) await db.exec(read('../../supabase/migrations/'+file));
  const migration=read('../../supabase/migrations/20261116150000_households_and_profile_keys.sql');
  await db.exec(migration);
  await db.exec('CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO anon,authenticated;');
  await db.exec(read('../../supabase/migrations/20260429000000_organization_url_rules.sql'));
  const unified=read('../../supabase/migrations/20261116170000_one_account_and_volunteer_profiles.sql');
  const seed=read('team-fixtures.sql').split('CREATE TEMP TABLE team_test_tokens')[0];
  const result=await db.exec(unified+read('../../supabase/migrations/20261116210000_profile_type_corrections.sql').replace(/COMMIT;\s*$/,'')+seed+read('profile-type-fixtures.sql'));
  const passed=result.flatMap(r=>r.rows||[]).find(row=>row.result?.startsWith('PASS:'));assert.ok(passed);console.log(passed.result);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM auth.users')).rows[0].count,0);
 }finally{await db.close();}
})().catch(error=>{console.error('Profile correction boundary test failed:',error.message,error.where||'');process.exitCode=1;});
