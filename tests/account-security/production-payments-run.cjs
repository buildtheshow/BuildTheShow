const {PGlite}=require('@electric-sql/pglite'),{pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.resolve(__dirname,file),'utf8');
(async()=>{const db=new PGlite({extensions:{pgcrypto}});try{
 await db.exec('CREATE EXTENSION pgcrypto;');
 await db.exec(['baseline.sql','team-baseline.sql','admission-baseline.sql','volunteer-baseline.sql','routes-baseline.sql'].map(read).join('\n'));
 await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;');
 for(const file of ['20261115103000_account_security_foundation.sql','20261115123000_account_bound_team_access.sql','20261115124500_require_team_session_for_staff_helpers.sql','20261115133000_audition_account_ownership.sql','20261116100000_volunteer_account_ownership.sql','20261116120000_private_record_routes.sql','20261116150000_households_and_profile_keys.sql','20261116170000_one_account_and_volunteer_profiles.sql','20261117173000_member_circles.sql'])await db.exec(read('../../supabase/migrations/'+file));
 await db.exec(read('team-fixtures.sql').split('CREATE TEMP TABLE team_test_tokens')[0]);
 await db.exec(read('../../supabase/migrations/20261116230000_beta_signup_invitations.sql'));
 await db.exec(read('../../supabase/migrations/20261121120000_circle_connections.sql'));
 await db.exec(read('../../supabase/migrations/20261121170000_member_production_payments.sql'));
 const result=await db.exec(read('production-payments-fixtures.sql'));
 assert.ok(result.some(r=>(r.rows||[]).some(row=>row.result?.startsWith('PASS:'))));

 console.log('PASS: production payments/instructions, accepted team participation, guardian boundaries and private access projection. Rolled back.');
}finally{await db.close();}})().catch(e=>{console.error(e.message,e.where||'');process.exitCode=1;});
