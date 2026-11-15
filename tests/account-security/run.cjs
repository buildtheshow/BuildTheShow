const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
(async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec('CREATE EXTENSION pgcrypto;');
    await db.exec(read('baseline.sql'));
    const migration = read('../../supabase/migrations/20261115103000_account_security_foundation.sql');
    assert.match(migration, /COMMIT;\s*$/);
    const results = await db.exec(migration.replace(/COMMIT;\s*$/, '') + read('fixtures.sql'));
    const passed = results.flatMap(result => result.rows || []).find(row => row.result?.startsWith('PASS:'));
    assert.ok(passed, 'The database boundary tests must finish successfully.');
    const { rows } = await db.query('SELECT count(*)::integer AS users FROM auth.users');
    assert.equal(rows[0].users, 0, 'Fixture data must be rolled back.');
    console.log(passed.result);
    console.log('PASS: all synthetic account records rolled back.');
  } finally { await db.close(); }
})().catch(error => {
  console.error('Account boundary test failed:', error.message, error.where || '');
  process.exitCode = 1;
});
