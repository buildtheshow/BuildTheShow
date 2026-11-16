const {PGlite}=require('@electric-sql/pglite');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.resolve(__dirname,file),'utf8');
(async()=>{const db=new PGlite({extensions:{pgcrypto}});try{
 await db.exec('CREATE EXTENSION pgcrypto;');
 await db.exec(read('baseline.sql'));
 await db.exec(read('../../supabase/migrations/20261115103000_account_security_foundation.sql'));
 const migration=read('../../supabase/migrations/20261116230000_beta_signup_invitations.sql');
 const result=await db.exec(migration.replace(/COMMIT;\s*$/,'')+read('beta-fixtures.sql'));
 assert.ok(result.some(r=>(r.rows||[]).some(row=>row.result?.startsWith('PASS:'))));
 assert.equal((await db.query('SELECT count(*)::int AS count FROM auth.users')).rows[0].count,0);
 console.log('PASS: beta admission requires a valid code on direct Auth inserts, keeps hashes private, strips secrets, enforces expiry/revocation/use limits and rolls failed signups back. Adult consent checks remain enforced.');
}finally{await db.close();}})().catch(error=>{console.error(error.message,error.where||'');process.exitCode=1;});
