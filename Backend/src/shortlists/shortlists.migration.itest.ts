import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

/**
 * Runs against the disposable test database prepared by `npm run test:env`.
 * The whole check happens inside one transaction that is rolled back, so the
 * shared database is left exactly as found.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';
const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const tag = randomBytes(4).toString('hex');
const tagDigits = String(parseInt(randomBytes(4).toString('hex'), 16) % 1e9).padStart(9, '0');

const sql = readFileSync(
  join(__dirname, '../../migrations/1789660800000_named-shortlists.sql'),
  'utf8',
);
const [upPart, downPart] = sql.split('-- Down Migration');
const UP = upPart.replace('-- Up Migration', '');
const DOWN = downPart;

async function seedUser(client: { query: Pool['query'] }, n: number): Promise<string> {
  const result = await client.query(
    `INSERT INTO "Users" ("name", "email", "passwordHash", "mobile", "mobileVerified", "gender")
     VALUES ($1, $2, 'x', $3, true, 'male') RETURNING "id"`,
    [`Shortlist ${n}`, `sl-${tag}-${n}@itest.example`, `9${tagDigits}${String(n).padStart(3, '0')}`],
  );

  return result.rows[0].id;
}

afterAll(async () => {
  await pool.end();
});

describe('named shortlists migration', () => {
  it('moves three flat rows into default-list memberships and restores them on down', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      // Return to the flat shape, then seed the legacy rows.
      await client.query(DOWN);

      const owner = await seedUser(client, 1);
      const targets = [await seedUser(client, 2), await seedUser(client, 3), await seedUser(client, 4)];

      for (const target of targets) {
        await client.query(`INSERT INTO "Shortlists" ("userId", "targetId") VALUES ($1, $2)`, [
          owner,
          target,
        ]);
      }

      await client.query(UP);

      const moved = await client.query(
        `SELECT count(*)::int AS "n", bool_and(l."isDefault") AS "allDefault"
         FROM "ShortlistProfiles" sp JOIN "ShortlistLists" l ON l."id" = sp."listId"
         WHERE l."userId" = $1`,
        [owner],
      );

      expect(moved.rows[0]).toEqual({ n: 3, allDefault: true });

      await client.query(DOWN);

      const restored = await client.query(
        `SELECT "targetId" FROM "Shortlists" WHERE "userId" = $1`,
        [owner],
      );

      expect(restored.rows.map((row) => row.targetId).sort()).toEqual([...targets].sort());
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
