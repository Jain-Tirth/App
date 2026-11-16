import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresDiscoveryRepository } from '../discovery/postgres-discovery.repository';
import { PostgresShortlistsRepository } from './postgres-shortlists.repository';
import { ShortlistLimitsService } from './shortlist-limits.service';
import { ShortlistsService } from './shortlists.service';
import './shortlists.controller';

/** Real database, real discovery rules; nothing is filtered after the query. */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';
const AGES = { male: 21, female: 18 };
const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const db = {
  query: (sql: string, params?: any[]) => pool.query(sql, params),
  transaction: async (callback: (client: any) => Promise<any>) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
const service = new ShortlistsService(
  new PostgresShortlistsRepository(db as any),
  new PostgresDiscoveryRepository(db as any),
  AGES,
  new ShortlistLimitsService({ maxLists: null, maxProfiles: null }),
);
const tag = randomBytes(4).toString('hex');
const tagDigits = String(parseInt(randomBytes(4).toString('hex'), 16) % 1e9).padStart(9, '0');
let sequence = 0;

async function seed(gender: 'male' | 'female', reviewStatus = 'approved') {
  sequence += 1;
  const unique = `${tag}${sequence}`;
  const user = await pool.query(
    `INSERT INTO "Users" ("name", "email", "passwordHash", "mobile", "mobileVerified",
                          "gender", "accountStatus", "profileReviewStatus")
     VALUES ($1, $2, 'x', $3, true, $4, 'active', $5) RETURNING "id"`,
    [
      `Sl${sequence} Surname`,
      `sl-${unique}@itest.example`,
      `9${tagDigits}${String(sequence).padStart(3, '0')}`,
      gender,
      reviewStatus,
    ],
  );
  const profile = await pool.query(
    `INSERT INTO "Profiles" ("userId", "profileUid") VALUES ($1, $2)
     RETURNING "id", "profileRef"`,
    [user.rows[0].id, `SL${unique}`.slice(0, 15)],
  );

  await pool.query(
    `INSERT INTO "ProfilePersonal" ("profileId", "dateOfBirth") VALUES ($1, '1990-01-01')`,
    [profile.rows[0].id],
  );

  return {
    userId: user.rows[0].id as string,
    profileRef: profile.rows[0].profileRef as string,
    auth: { sub: user.rows[0].id } as any,
  };
}

async function rejection(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'none';
  } catch (error: any) {
    return error.code ?? 'OTHER';
  }
}

afterAll(async () => {
  await pool.end();
}, 30000);

describe('shortlists service on the real database', () => {
  it('creates one default list, protects it, and enforces name rules', async () => {
    const me = await seed('male');
    const other = await seed('male');
    const first = await service.list(me.auth);
    const second = await service.list(me.auth);

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ name: 'Shortlisted', isDefault: true });
    expect(second[0].id).toBe(first[0].id);
    expect(await rejection(service.remove(me.auth, first[0].id))).toBe(
      'DEFAULT_SHORTLIST_PROTECTED',
    );
    expect(await rejection(service.rename(me.auth, first[0].id, 'X'))).toBe(
      'DEFAULT_SHORTLIST_PROTECTED',
    );

    await service.create(me.auth, 'Family');

    expect(await rejection(service.create(me.auth, 'fAMILY'))).toBe('SHORTLIST_NAME_TAKEN');
    expect(await rejection(service.create(me.auth, 'shortlisted'))).toBe('SHORTLIST_NAME_TAKEN');
    await service.create(other.auth, 'Family');

    for (let i = 0; i < 25; i += 1) {
      await service.create(me.auth, `List ${i}`);
    }

    expect(await service.list(me.auth)).toHaveLength(27);
    expect(await rejection(service.rename(other.auth, first[0].id, 'Mine'))).toBe(
      'SHORTLIST_NOT_FOUND',
    );
  }, 60000);

  it('creates exactly one default list under parallel first reads (25 fresh users)', async () => {
    for (let i = 0; i < 25; i += 1) {
      const me = await seed('male');
      const results = await Promise.all(
        Array.from({ length: 10 }, () => service.list(me.auth)),
      );
      const ids = new Set(results.map((lists) => lists[0].id));
      const rows = await pool.query(
        `SELECT count(*)::int AS "n" FROM "ShortlistLists" WHERE "userId" = $1 AND "isDefault"`,
        [me.userId],
      );

      expect(ids.size).toBe(1);
      expect(rows.rows[0].n).toBe(1);
    }
  }, 120000);

  it('allows exactly one of many parallel creates with the same name', async () => {
    for (let i = 0; i < 20; i += 1) {
      const me = await seed('male');
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, () => rejection(service.create(me.auth, 'Same'))),
      );

      expect(outcomes.filter((o) => o === 'none')).toHaveLength(1);
      expect(outcomes.filter((o) => o === 'SHORTLIST_NAME_TAKEN')).toHaveLength(7);
      expect(await service.list(me.auth)).toHaveLength(2);
    }
  }, 120000);

  it('creates every list for parallel creates with different names', async () => {
    const me = await seed('male');
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, (_, i) => rejection(service.create(me.auth, `Name ${i}`))),
    );

    expect(outcomes.every((o) => o === 'none')).toBe(true);
    expect(await service.list(me.auth)).toHaveLength(9);
  });

  it('adds idempotently, spans lists, omits hidden profiles, and deletes lists safely', async () => {
    const me = await seed('male');
    const bride = await seed('female');
    const pending = await seed('female', 'submitted');
    const [main] = await service.list(me.auth);
    const extra = await service.create(me.auth, 'Extra');

    await service.addProfile(me.auth, main.id, bride.profileRef);
    await service.addProfile(me.auth, main.id, bride.profileRef);
    await service.addProfile(me.auth, extra.id, bride.profileRef);

    expect((await service.list(me.auth)).map((l) => l.profileCount)).toEqual([1, 1]);
    expect(await rejection(service.addProfile(me.auth, main.id, pending.profileRef))).toBe(
      'PROFILE_NOT_FOUND',
    );
    expect(await rejection(service.addProfile(me.auth, main.id, me.profileRef))).toBe(
      'CANNOT_SHORTLIST_SELF',
    );

    const page = await service.profiles(me.auth, main.id, {});

    expect(page.items.map((card) => card.profileRef)).toEqual([bride.profileRef]);

    await service.remove(me.auth, extra.id);

    expect((await service.profiles(me.auth, main.id, {})).items).toHaveLength(1);

    await pool.query(`UPDATE "Users" SET "profileReviewStatus" = 'rejected' WHERE "id" = $1`, [
      bride.userId,
    ]);

    expect((await service.profiles(me.auth, main.id, {})).items).toHaveLength(0);
    expect((await service.list(me.auth))[0].profileCount).toBe(1);

    await service.removeProfile(me.auth, main.id, bride.profileRef);
    await service.removeProfile(me.auth, main.id, bride.profileRef);

    expect((await service.list(me.auth))[0].profileCount).toBe(0);
  });

  it('paginates with a cursor and accepts 250 distinct profiles with no limit', async () => {
    const me = await seed('male');
    const [main] = await service.list(me.auth);
    const refs: string[] = [];

    for (let i = 0; i < 250; i += 1) {
      refs.push((await seed('female')).profileRef);
    }

    for (const ref of refs) {
      await service.addProfile(me.auth, main.id, ref);
    }

    const one = await service.profiles(me.auth, main.id, { limit: 50 });
    const two = await service.profiles(me.auth, main.id, {
      limit: 50,
      cursor: one.nextCursor!,
    });

    expect(one.items).toHaveLength(50);
    expect(two.items).toHaveLength(50);
    expect(new Set([...one.items, ...two.items].map((c) => c.profileRef)).size).toBe(100);
  }, 120000);
});
