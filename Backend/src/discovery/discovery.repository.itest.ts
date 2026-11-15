import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresDiscoveryRepository } from './postgres-discovery.repository';
import { DiscoveryService } from './discovery.service';
import type { DiscoveryCard } from './discovery.types';

/**
 * Runs against the disposable test database prepared by `npm run test:env`
 * (and migrated by it). Nothing here filters results after the query: every
 * expectation is about what the SQL itself returns.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';

const tagDigits = String(parseInt(randomBytes(4).toString('hex'), 16) % 1e9).padStart(9, '0');
const AGES ={ male: 21, female: 18 };
const tag = randomBytes(4).toString('hex');
const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const repository = new PostgresDiscoveryRepository({
  query: (sql, params) => pool.query(sql, params),
  transaction: async (callback) => {
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
});
const service = new DiscoveryService(repository, AGES, 3);

interface SeedOptions {
  name: string;
  gender: 'male' | 'female';
  reviewStatus?: string;
  accountStatus?: string;
  dateOfBirth?: string;
  religion?: string;
  caste?: string;
  state?: string;
  city?: string;
  maritalStatus?: string;
  diet?: string;
  idVerified?: boolean;
}

interface Seeded {
  userId: string;
  profileRef: string;
}

let sequence = 0;

async function seed(options: SeedOptions): Promise<Seeded> {
  sequence += 1;
  const unique = `${tag}${sequence}`;
  const user = await pool.query(
    `INSERT INTO "Users" ("name", "email", "passwordHash", "mobile", "mobileVerified",
                          "gender", "accountStatus", "profileReviewStatus")
     VALUES ($1, $2, 'x', $3, true, $4, $5, $6) RETURNING "id"`,
    [
      `${options.name} Surname`,
      `disc-${unique}@itest.example`,
      `9${tagDigits}${String(sequence).padStart(3, '0')}`,
      options.gender,
      options.accountStatus ?? 'active',
      options.reviewStatus ?? 'approved',
    ],
  );
  const userId: string = user.rows[0].id;
  const profile = await pool.query(
    `INSERT INTO "Profiles" ("userId", "profileUid", "idVerified")
     VALUES ($1, $2, $3) RETURNING "id", "profileRef"`,
    [userId, `IT${unique}`.slice(0, 15), options.idVerified ?? true],
  );
  const profileId: string = profile.rows[0].id;

  await pool.query(
    `INSERT INTO "ProfilePersonal" ("profileId", "dateOfBirth", "maritalStatus", "eatingHabits")
     VALUES ($1, $2, $3, $4)`,
    [
      profileId,
      options.dateOfBirth ?? '1990-01-01',
      options.maritalStatus ?? 'neverMarried',
      options.diet ?? 'vegetarian',
    ],
  );
  await pool.query(
    `INSERT INTO "ProfileReligious" ("profileId", "religion", "caste") VALUES ($1, $2, $3)`,
    [profileId, options.religion ?? 'Hindu', options.caste ?? 'Dhobi'],
  );
  await pool.query(
    `INSERT INTO "ProfileLocations" ("profileId", "state", "city") VALUES ($1, $2, $3)`,
    [profileId, options.state ?? 'Gujarat', options.city ?? `City${tag}`],
  );

  return { userId, profileRef: profile.rows[0].profileRef };
}

async function addPhoto(
  userId: string,
  kind: string,
  validationStatus = 'approved',
): Promise<string> {
  const photo = await pool.query(
    `INSERT INTO "ProfilePhotos" ("userId", "fileUrl", "isPrimary", "validationStatus", "photoKind")
     VALUES ($1, 'k', true, $2, $3) RETURNING "id"`,
    [userId, validationStatus, kind],
  );

  return photo.rows[0].id;
}

async function everything(
  caller: Seeded,
  filters: Record<string, string> = {},
): Promise<DiscoveryCard[]> {
  const items: DiscoveryCard[] = [];
  let cursor: string | undefined;

  do {
    const page = await service.search(
      { sub: caller.userId, email: 'c@example.com', role: 'user' },
      { ...filters, limit: 50, cursor },
    );

    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return items;
}

const asUser = (seeded: Seeded) => ({
  sub: seeded.userId,
  email: 'c@example.com',
  role: 'user' as const,
});

describe('discovery against PostgreSQL', () => {
  let caller: Seeded;

  beforeAll(async () => {
    caller = await seed({ name: `Caller${tag}`, gender: 'female' });
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM "ProfileViews" WHERE "viewerId" IN
         (SELECT "id" FROM "Users" WHERE "email" LIKE $1)`,
      [`disc-${tag}%@itest.example`],
    );
    await pool.query(`DELETE FROM "Users" WHERE "email" LIKE $1`, [
      `disc-${tag}%@itest.example`,
    ]);
    await pool.end();
  });

  it('assigns every profile a random 32-hex profileRef unrelated to profileUid', async () => {
    const other = await seed({ name: `Ref${tag}`, gender: 'male' });
    const row = await pool.query(
      `SELECT "profileRef", "profileUid" FROM "Profiles" WHERE "userId" = $1`,
      [other.userId],
    );

    expect(row.rows[0].profileRef).toMatch(/^[0-9a-f]{32}$/);
    expect(row.rows[0].profileRef).not.toContain(row.rows[0].profileUid);
    expect(other.profileRef).not.toBe(caller.profileRef);
  });

  it('returns only approved, visible, adult, opposite-gender members', async () => {
    const city = `Hard${tag}`;
    const approved = await seed({ name: `Okay${tag}`, gender: 'male', city });

    for (const status of ['draft', 'submitted', 'needsChanges', 'rejected']) {
      await seed({ name: `S${status}${tag}`, gender: 'male', city, reviewStatus: status });
    }

    await seed({ name: `Blocked${tag}`, gender: 'male', city, accountStatus: 'blocked' });
    const hidden = await seed({ name: `Hidden${tag}`, gender: 'male', city });
    await pool.query(
      `INSERT INTO "HiddenProfiles" ("userId", "hiddenId") VALUES ($1, $2)`,
      [caller.userId, hidden.userId],
    );
    const nineteen = new Date();
    nineteen.setUTCFullYear(nineteen.getUTCFullYear() - 19);
    await seed({
      name: `Young${tag}`,
      gender: 'male',
      city,
      dateOfBirth: nineteen.toISOString().slice(0, 10),
    });
    await seed({ name: `Woman${tag}`, gender: 'female', city });

    const found = await everything(caller, { city });

    expect(found.map((card) => card.profileRef)).toEqual([approved.profileRef]);
  });

  it('admits a woman of 19 where a man of 19 is refused', async () => {
    const city = `Gate${tag}`;
    const viewer = await seed({ name: `Viewer${tag}`, gender: 'male' });
    const nineteen = new Date();
    nineteen.setUTCFullYear(nineteen.getUTCFullYear() - 19);
    const woman = await seed({
      name: `Nineteen${tag}`,
      gender: 'female',
      city,
      dateOfBirth: nineteen.toISOString().slice(0, 10),
    });

    const found = await everything(viewer, { city });

    expect(found.map((card) => card.profileRef)).toEqual([woman.profileRef]);
  });

  it('never returns the caller', async () => {
    const found = await everything(caller);

    expect(found.map((card) => card.profileRef)).not.toContain(caller.profileRef);
  });

  describe('filters', () => {
    const base = `Flt${tag}`;
    let a: Seeded;
    let b: Seeded;

    beforeAll(async () => {
      a = await seed({
        name: `FltA${tag}`,
        gender: 'male',
        religion: `Rel${base}`,
        caste: `Com${base}`,
        state: `St${base}`,
        city: `Ct${base}`,
        maritalStatus: 'divorced',
        diet: 'eggetarian',
      });
      b = await seed({ name: `FltB${tag}`, gender: 'male', maritalStatus: 'widower', diet: 'nonVegetarian' });
    });

    it.each([
      ['religion', `Rel${base}`],
      ['community', `Com${base}`],
      ['state', `St${base}`],
      ['city', `Ct${base}`],
      ['maritalStatus', 'divorced'],
      ['diet', 'eggetarian'],
    ])('%s narrows to matching profiles', async (name, value) => {
      const refs = (await everything(caller, { [name]: value })).map((c) => c.profileRef);

      expect(refs).toContain(a.profileRef);
      expect(refs).not.toContain(b.profileRef);
    });

    it('matches case-insensitively', async () => {
      const refs = (await everything(caller, { city: `ct${base}`.toUpperCase() })).map(
        (c) => c.profileRef,
      );

      expect(refs).toContain(a.profileRef);
    });

    it('a SQL metacharacter in a string filter yields zero rows, not an error', async () => {
      const found = await everything(caller, {
        city: `x'; DROP TABLE "Users"; --`,
      });

      expect(found).toEqual([]);
    });
  });

  describe('pagination', () => {
    it('shows no duplicate and no gap when a profile is inserted between pages', async () => {
      const city = `Page${tag}`;
      const seeded: Seeded[] = [];

      for (let i = 0; i < 5; i += 1) {
        seeded.push(await seed({ name: `P${i}${tag}`, gender: 'male', city }));
      }

      const first = await service.search(asUser(caller), { city, limit: 2 });
      const newcomer = await seed({ name: `New${tag}`, gender: 'male', city });
      const second = await service.search(asUser(caller), {
        city,
        limit: 10,
        cursor: first.nextCursor ?? undefined,
      });
      const shown = [...first.items, ...second.items].map((c) => c.profileRef);

      expect(first.nextCursor).not.toBeNull();
      expect(second.nextCursor).toBeNull();
      expect(new Set(shown).size).toBe(shown.length);
      expect(shown).toHaveLength(5);
      expect(shown).not.toContain(newcomer.profileRef);
      expect([...shown].sort()).toEqual(seeded.map((s) => s.profileRef).sort());
    });
  });

  describe('result card', () => {
    it('contains only allowlisted keys and the computed age', async () => {
      const city = `Card${tag}`;
      await seed({ name: `Card${tag}`, gender: 'male', city });
      const [card] = await everything(caller, { city });

      expect(Object.keys(card).sort()).toEqual(
        [
          'age',
          'city',
          'community',
          'firstName',
          'photoRef',
          'profession',
          'profileRef',
          'religion',
          'verified',
        ].sort(),
      );
      expect(card.firstName).toBe(`Card${tag}`);
      expect(card.age).toBeGreaterThanOrEqual(35);
    });

    it('serves only the individual primary approved photo', async () => {
      const city = `Photo${tag}`;
      const withPhoto = await seed({ name: `Ph1${tag}`, gender: 'male', city });
      const withFamily = await seed({ name: `Ph2${tag}`, gender: 'male', city });
      const withPending = await seed({ name: `Ph3${tag}`, gender: 'male', city });
      const photoId = await addPhoto(withPhoto.userId, 'individual');
      await addPhoto(withFamily.userId, 'family');
      await addPhoto(withPending.userId, 'individual', 'pending');

      const cards = await everything(caller, { city });
      const refOf = (seeded: Seeded) =>
        cards.find((card) => card.profileRef === seeded.profileRef)?.photoRef;

      expect(refOf(withPhoto)).toBe(photoId);
      expect(refOf(withFamily)).toBeNull();
      expect(refOf(withPending)).toBeNull();
    });
  });

  describe('profile detail', () => {
    it('shows an approved profile and records one view per viewer, target and day', async () => {
      const target = await seed({ name: `Det${tag}`, gender: 'male' });

      const detail = await service.getProfile(asUser(caller), target.profileRef);
      await service.getProfile(asUser(caller), target.profileRef);

      const views = await pool.query(
        `SELECT count(*)::int AS n FROM "ProfileViews" WHERE "viewerId" = $1 AND "viewedId" = $2`,
        [caller.userId, target.userId],
      );

      expect(detail.profileRef).toBe(target.profileRef);
      expect(detail).not.toHaveProperty('email');
      expect(detail).not.toHaveProperty('mobile');
      expect(detail).not.toHaveProperty('dateOfBirth');
      expect(detail).not.toHaveProperty('profileUid');
      expect(detail).not.toHaveProperty('viewedUserId');
      expect(views.rows[0].n).toBe(1);
    });

    it('answers 404 PROFILE_NOT_FOUND for non-approved, hidden, own and unknown profiles', async () => {
      const submitted = await seed({ name: `Sub${tag}`, gender: 'male', reviewStatus: 'submitted' });
      const hidden = await seed({ name: `Hid${tag}`, gender: 'male' });
      await pool.query(
        `INSERT INTO "HiddenProfiles" ("userId", "hiddenId") VALUES ($1, $2)`,
        [caller.userId, hidden.userId],
      );

      for (const ref of [
        submitted.profileRef,
        hidden.profileRef,
        caller.profileRef,
        'f'.repeat(32),
      ]) {
        await expect(service.getProfile(asUser(caller), ref)).rejects.toMatchObject({
          status: 404,
          code: 'PROFILE_NOT_FOUND',
        });
      }
    });
  });

  describe('daily recommendations', () => {
    it('returns the same capped set twice and never a hidden profile', async () => {
      const viewer = await seed({ name: `Rec${tag}`, gender: 'female' });

      for (let i = 0; i < 6; i += 1) {
        await seed({ name: `Cand${i}${tag}`, gender: 'male' });
      }

      const first = await service.dailyRecommendations(asUser(viewer));
      const second = await service.dailyRecommendations(asUser(viewer));

      expect(first.length).toBe(3);
      expect(new Set(first.map((c) => c.profileRef)).size).toBe(3);
      expect(second.map((c) => c.profileRef)).toEqual(first.map((c) => c.profileRef));
    });

    it('drops a profile hidden after the set was fixed', async () => {
      const viewer = await seed({ name: `Rec2${tag}`, gender: 'female' });
      await seed({ name: `Cand2${tag}`, gender: 'male' });
      const first = await service.dailyRecommendations(asUser(viewer));
      const victim = await pool.query(
        `SELECT "userId" FROM "Profiles" WHERE "profileRef" = $1`,
        [first[0].profileRef],
      );

      await pool.query(
        `INSERT INTO "HiddenProfiles" ("userId", "hiddenId") VALUES ($1, $2)`,
        [viewer.userId, victim.rows[0].userId],
      );

      const after = await service.dailyRecommendations(asUser(viewer));

      expect(after.map((c) => c.profileRef)).not.toContain(first[0].profileRef);
    });
  });
});
