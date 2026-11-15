const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(path.resolve(__dirname,file),'utf8');
(async () => {
  const db = new PGlite({extensions:{pgcrypto}});
  try {
    await db.exec('CREATE EXTENSION pgcrypto;');
    await db.exec(read('baseline.sql')+read('team-baseline.sql'));
    await db.exec(read('../../supabase/migrations/20261115103000_account_security_foundation.sql'));
    const migration=read('../../supabase/migrations/20261115123000_account_bound_team_access.sql');
    const results=await db.exec(migration.replace(/COMMIT;\s*$/,'')+read('team-fixtures.sql'));
    const passed=results.flatMap(result=>result.rows||[]).find(row=>row.result?.startsWith('PASS:'));
    assert.ok(passed,'Team boundary tests must finish.');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM auth.users')).rows[0].count,0);
    console.log(passed.result);
  } finally { await db.close(); }
})().catch(error=>{console.error('Team boundary test failed:',error.message,error.where||'',error.position||'',error.query?.slice(Math.max(0,Number(error.position)-120),Number(error.position)+120)||'');process.exitCode=1;});
