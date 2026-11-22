import { Pool } from 'pg';

/**
 * Runs against the disposable test database prepared by `npm run test:env`.
 * Everything happens in one rolled-back transaction.
 */
const pool = new Pool({
  connectionString:
    'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test',
});

const QUEUE_SQL = `SELECT u."id" FROM "v_profiles_awaiting_review" q
                   JOIN "Users" u ON u."id" = q."userId"`;

afterAll(async () => {
  await pool.end();
});

async function seed(
  client: { query: Pool['query'] },
  tag: string,
  status: string,
  review: string,
  submitted: boolean,
): Promise<string> {
  const result = await client.query(
    `INSERT INTO "Users" ("name","email","passwordHash","mobile","accountStatus",
                          "profileReviewStatus","profileSubmittedAt")
     VALUES ($1, $2, 'x', $3, $4, $5, ${submitted ? 'now()' : 'NULL'})
     RETURNING "id"`,
    [tag, `${tag}@dash.test`, `9${Math.floor(Math.random() * 1e9)}`.slice(0, 10), status, review],
  );

  return result.rows[0].id as string;
}

async function pending(client: { query: Pool['query'] }): Promise<number> {
  const result = await client.query(
    `SELECT (fn_admin_get_dashboard_stats()->>'pendingApprovals')::int AS n`,
  );

  return result.rows[0].n as number;
}

describe('dashboard pending count equals the review queue', () => {
  it('counts only members who submitted, and lists exactly them', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const before = await pending(client);
      const queueBefore = (await client.query(QUEUE_SQL)).rows.length;

      expect(before).toBe(queueBefore);

      const never = await seed(client, 'never-submitted', 'pending', 'draft', false);
      expect(await pending(client)).toBe(before);
      expect(
        (await client.query(QUEUE_SQL)).rows.map((r) => r.id),
      ).not.toContain(never);

      const sent = await seed(client, 'submitted', 'pending', 'submitted', true);
      expect(await pending(client)).toBe(before + 1);
      expect((await client.query(QUEUE_SQL)).rows.map((r) => r.id)).toContain(sent);

      // other states never counted nor listed
      await seed(client, 'needs-changes', 'pending', 'needsChanges', true);
      await seed(client, 'approved', 'active', 'approved', true);
      expect(await pending(client)).toBe(before + 1);
      expect((await client.query(QUEUE_SQL)).rows.length).toBe(before + 1);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
