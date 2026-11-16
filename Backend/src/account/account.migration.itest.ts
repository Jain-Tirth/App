import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

/**
 * Runs against the disposable test database prepared by `npm run test:env`.
 * The check happens inside one transaction that is rolled back, so the shared
 * database is left exactly as found.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';
const pool = new Pool({ connectionString: TEST_DATABASE_URL });

const sql = readFileSync(
  join(__dirname, '../../migrations/1789660900000_account-settings-and-deletion.sql'),
  'utf8',
);
const [upPart, downPart] = sql.split('-- Down Migration');
const UP = upPart.replace('-- Up Migration', '');
const DOWN = downPart;

afterAll(async () => {
  await pool.end();
});

async function columns(client: { query: Pool['query'] }, table: string) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );

  return result.rows.map((row) => row.column_name as string);
}

function parts(file: string) {
  const text = readFileSync(join(__dirname, '../../migrations', file), 'utf8');
  const [up, down] = text.split('-- Down Migration');

  return { up: up.replace('-- Up Migration', ''), down };
}

describe('story 9 follow-up migrations', () => {
  const trigger = parts('1789661000000_consent-anonymise-needs-pending-purge.sql');
  const audit = parts('1789661100000_account-audit-log.sql');
  const identifier = parts('1789661200000_user-identifier-session-version.sql');

  it('revert in reverse order and apply again', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(identifier.down);
      await client.query(audit.down);
      await client.query(trigger.down);

      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'AccountAuditLog'`,
      );
      const functions = await client.query(
        `SELECT proname FROM pg_proc WHERE proname IN ('fn_account_purge_permits', 'fn_account_audit_log_append_only')`,
      );
      const returned = await client.query(
        `SELECT count(*)::int AS n FROM pg_proc p
         WHERE p.proname = 'fn_get_user_by_identifier'
           AND pg_get_function_result(p.oid) LIKE '%sessionVersion%'`,
      );

      expect(tables.rows).toHaveLength(0);
      expect(functions.rows).toHaveLength(0);
      expect(returned.rows[0].n).toBe(0);

      await client.query(trigger.up);
      await client.query(audit.up);
      await client.query(identifier.up);

      const back = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'AccountAuditLog'`,
      );
      const withVersion = await client.query(
        `SELECT count(*)::int AS n FROM pg_proc p
         WHERE p.proname = 'fn_get_user_by_identifier'
           AND pg_get_function_result(p.oid) LIKE '%sessionVersion%'`,
      );

      expect(back.rows).toHaveLength(1);
      expect(withVersion.rows[0].n).toBe(1);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('account settings and deletion migration', () => {
  it('reverts to the previous schema and applies again', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(DOWN);

      const downUsers = await columns(client, 'Users');

      for (const name of [
        'language',
        'notificationPrefs',
        'profileVisibility',
        'sessionVersion',
        'deletionRequestedAt',
        'deletionScheduledPurgeAt',
      ]) {
        expect(downUsers).not.toContain(name);
      }

      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_name IN ('AccountExportRequests', 'StepUpFailures')`,
      );

      expect(tables.rows).toHaveLength(0);

      const nullable = await client.query(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_name = 'ConsentRecords' AND column_name = 'userId'`,
      );

      expect(nullable.rows[0].is_nullable).toBe('NO');

      await client.query(UP);

      expect(await columns(client, 'Users')).toEqual(
        expect.arrayContaining(['language', 'sessionVersion', 'deletionScheduledPurgeAt']),
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
