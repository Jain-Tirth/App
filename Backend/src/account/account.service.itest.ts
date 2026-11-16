import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PostgresDiscoveryRepository } from '../discovery/postgres-discovery.repository';
import { AccountPurgeService } from './account-purge.service';
import { AccountService } from './account.service';
import { PostgresAccountRepository } from './postgres-account.repository';
import { PostgresPurgeRepository } from './postgres-purge.repository';
import { PostgresStepUpRepository } from './postgres-step-up.repository';
import { StepUpService } from './step-up.service';

/** Real database; the purge and the export run against real rows. */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';
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

const CONFIG = {
  deletionCoolingOffDays: 30,
  exportLinkHours: 24,
  stepUpMaxFailures: 5,
  stepUpWindowMinutes: 15,
};
const PASSWORD = 'Correct-horse-1';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);
const AGES = { male: 21, female: 18 };

let now = new Date();
const clock = () => now;
const accounts = new PostgresAccountRepository(db as any);
const stepUp = new StepUpService(new PostgresStepUpRepository(db as any), CONFIG, clock);
const service = new AccountService(accounts, stepUp, CONFIG, clock);
const removedKeys: string[] = [];
const purge = new AccountPurgeService(
  new PostgresPurgeRepository(db as any),
  { remove: async (key: string) => void removedKeys.push(key) } as any,
  clock,
);
const strategy = new JwtStrategy(db as any);

const AUDIT = { ip: '203.0.113.9', userAgent: 'itest-agent' };

const tag = randomBytes(4).toString('hex');
const tagDigits = String(parseInt(randomBytes(4).toString('hex'), 16) % 1e9).padStart(9, '0');
let sequence = 0;

async function seed(gender: 'male' | 'female', name = `Member${sequence + 1} Surname`) {
  sequence += 1;
  const unique = `${tag}${sequence}`;
  const user = await pool.query(
    `INSERT INTO "Users" ("name", "email", "passwordHash", "mobile", "mobileVerified",
                          "gender", "accountStatus", "profileReviewStatus")
     VALUES ($1, $2, $3, $4, true, $5, 'active', 'approved') RETURNING "id"`,
    [
      name,
      `acct-${unique}@itest.example`,
      PASSWORD_HASH,
      `9${tagDigits}${String(sequence).padStart(3, '0')}`,
      gender,
    ],
  );
  const profile = await pool.query(
    `INSERT INTO "Profiles" ("userId", "profileUid") VALUES ($1, $2)
     RETURNING "id", "profileRef"`,
    [user.rows[0].id, `AC${unique}`.slice(0, 15)],
  );

  await pool.query(
    `INSERT INTO "ProfilePersonal" ("profileId", "dateOfBirth") VALUES ($1, '1990-01-01')`,
    [profile.rows[0].id],
  );

  return {
    userId: user.rows[0].id as string,
    profileRef: profile.rows[0].profileRef as string,
  };
}

async function count(table: string, column: string, id: string): Promise<number> {
  const result = await pool.query(
    `SELECT count(*)::int AS n FROM "${table}" WHERE "${column}" = $1`,
    [id],
  );

  return result.rows[0].n;
}

async function rejection(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'none';
  } catch (error: any) {
    return error.code ?? error.message ?? 'OTHER';
  }
}

beforeEach(() => {
  now = new Date();
});

afterAll(async () => {
  await pool.end();
});

describe('settings', () => {
  it('defaults, merges notification flags and persists language', async () => {
    const member = await seed('male');

    expect(await service.getSettings(member.userId)).toEqual({
      language: 'en',
      notifications: {
        interestReceived: true,
        interestAccepted: true,
        profileApproved: true,
        newMessage: true,
        profileViewed: true,
      },
      profileVisibility: 'all',
    });

    const updated = await service.updateSettings(member.userId, {
      language: 'gu',
      notifications: { newMessage: false },
    });

    expect(updated.language).toBe('gu');
    expect(updated.notifications.newMessage).toBe(false);
    expect(updated.notifications.profileViewed).toBe(true);
    expect((await service.getSettings(member.userId)).language).toBe('gu');
  });
});

describe('logout-all', () => {
  it('rejects the member`s access tokens and refresh session, and nobody else`s', async () => {
    const a = await seed('male');
    const b = await seed('female');

    for (const id of [a.userId, b.userId]) {
      await pool.query(
        `INSERT INTO "UserSessions" ("userId", "refreshTokenHash", "refreshTokenExpiresAt")
         VALUES ($1, 'hash', now() + interval '30 days')`,
        [id],
      );
    }

    const token = (id: string, sv?: number) => ({
      sub: id,
      email: 'x@example.com',
      role: 'user' as const,
      sv,
    });

    expect(await strategy.validate(token(a.userId, 0))).toMatchObject({ sub: a.userId });
    expect(await strategy.validate(token(a.userId))).toMatchObject({ sub: a.userId });

    await service.logoutAll(a.userId, AUDIT);

    expect(await rejection(strategy.validate(token(a.userId, 0)))).toBe('Your session has ended. Log in again.');
    expect(await rejection(strategy.validate(token(a.userId)))).toBe('Your session has ended. Log in again.');
    expect(await strategy.validate(token(a.userId, 1))).toMatchObject({ sub: a.userId });
    expect(await count('UserSessions', 'userId', a.userId)).toBe(0);

    expect(await strategy.validate(token(b.userId, 0))).toMatchObject({ sub: b.userId });
    expect(await count('UserSessions', 'userId', b.userId)).toBe(1);
  });

  it('rejects a token of a member that no longer exists', async () => {
    expect(
      await rejection(
        strategy.validate({ sub: randomUUID(), email: 'x@example.com', role: 'user' }),
      ),
    ).toBe('Your session has ended. Log in again.');
  });
});

describe('step-up', () => {
  it('limits failures per member and never creates the export', async () => {
    const a = await seed('male');
    const b = await seed('female');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await rejection(service.requestExport(a.userId, 'bad', AUDIT))).toBe('STEP_UP_FAILED');
    }

    expect(await rejection(service.requestExport(a.userId, PASSWORD, AUDIT))).toBe('RATE_LIMITED');
    expect(await count('AccountExportRequests', 'userId', a.userId)).toBe(0);
    expect((await service.requestExport(b.userId, PASSWORD, AUDIT)).status).toBe('pending');
  });

  it('records at most the configured failures when wrong passwords arrive in parallel', async () => {
    const member = await seed('male');
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        rejection(service.requestExport(member.userId, 'wrong', AUDIT)),
      ),
    );

    expect(outcomes.filter((code) => code === 'STEP_UP_FAILED')).toHaveLength(5);
    expect(outcomes.filter((code) => code === 'RATE_LIMITED')).toHaveLength(3);
    expect(await count('StepUpFailures', 'userId', member.userId)).toBe(5);
    expect(await count('AccountExportRequests', 'userId', member.userId)).toBe(0);
  });

  it('does not let a parallel burst hide the right password behind the limit', async () => {
    const member = await seed('female');
    const outcomes = await Promise.all([
      rejection(service.requestExport(member.userId, PASSWORD, AUDIT)),
      rejection(service.requestExport(member.userId, 'wrong', AUDIT)),
      rejection(service.requestExport(member.userId, 'wrong', AUDIT)),
    ]);

    expect(outcomes.filter((code) => code === 'none')).toHaveLength(1);
    expect(await count('StepUpFailures', 'userId', member.userId)).toBe(2);
  });
});

describe('export', () => {
  it('holds the member`s own data and nothing secret or foreign', async () => {
    const a = await seed('male', 'Arjun Shah');
    const b = await seed('female', 'Bela Mehta');

    await pool.query(
      `INSERT INTO "UserSessions" ("userId", "refreshTokenHash", "refreshTokenExpiresAt")
       VALUES ($1, 'REFRESH-HASH-MARKER', now() + interval '30 days')`,
      [a.userId],
    );
    await pool.query(
      `INSERT INTO "KycVerifications"
         ("userId", "status", "providerSessionId", "documentType", "idNumberEncrypted", "idNumberLast4")
       VALUES ($1, 'needsReview', 's', 'aadhaar', 'ENCRYPTED-ID-MARKER', '9012')`,
      [a.userId],
    );
    await pool.query(
      `INSERT INTO "ConsentRecords"
         ("userId", "userName", "code", "version", "documentHash", "textSnapshot", "language",
          "ip", "userAgent", "expiresAt", "source")
       VALUES ($1, 'Arjun Shah', 'terms', '1.0', 'h', 'I agree', 'en', '10.0.0.1', 'UA', now() + interval '1 year', 'api')`,
      [a.userId],
    );
    await pool.query(
      `INSERT INTO "Interests" ("senderId", "receiverId", "status") VALUES ($1, $2, 'pending')`,
      [a.userId, b.userId],
    );
    await pool.query(
      `INSERT INTO "Interests" ("senderId", "receiverId", "status") VALUES ($1, $2, 'pending')`,
      [b.userId, a.userId],
    );
    const list = await pool.query(
      `INSERT INTO "ShortlistLists" ("userId", "name", "isDefault") VALUES ($1, 'Shortlisted', true) RETURNING "id"`,
      [a.userId],
    );
    await pool.query(
      `INSERT INTO "ShortlistProfiles" ("listId", "targetId") VALUES ($1, $2)`,
      [list.rows[0].id, b.userId],
    );

    const requested = await service.requestExport(a.userId, PASSWORD, AUDIT);

    expect(requested.status).toBe('pending');
    expect(await rejection(service.requestExport(a.userId, PASSWORD, AUDIT))).toBe('REQUEST_ALREADY_PENDING');

    const archive = await service.downloadExport(a.userId, requested.requestId, AUDIT);
    const text = JSON.stringify(archive);

    expect(archive.format).toBe('dhobi-matrimony-export');
    expect((archive as any).account.user.email).toBe(`acct-${tag}${sequence - 1}@itest.example`);
    expect((archive as any).verification).toMatchObject({ idNumberLast4: '9012' });
    expect((archive as any).consents).toHaveLength(1);
    expect((archive as any).interests.sent).toHaveLength(1);
    expect((archive as any).interests.sent[0]).toMatchObject({
      profileRef: b.profileRef,
      firstName: 'Bela',
      status: 'pending',
    });
    expect((archive as any).interests.received).toHaveLength(1);
    expect((archive as any).shortlists[0].profiles).toEqual([
      expect.objectContaining({ profileRef: b.profileRef }),
    ]);

    // Absent: password hash, refresh token, full or encrypted ID number, the
    // other member's contact details and the consent ip.
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain(PASSWORD_HASH);
    expect(text).not.toContain('REFRESH-HASH-MARKER');
    expect(text).not.toContain('refreshToken');
    expect(text).not.toContain('ENCRYPTED-ID-MARKER');
    expect(text).not.toContain('idNumberEncrypted');
    expect(text).not.toContain(`acct-${tag}${sequence}@itest.example`);
    expect(text).not.toContain('Mehta');
    expect(text).not.toContain('10.0.0.1');

    // Owned by the member, expiring after 24 hours.
    expect(await rejection(service.downloadExport(b.userId, requested.requestId, AUDIT))).toBe('EXPORT_NOT_FOUND');
    now = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1000);
    expect(await rejection(service.downloadExport(a.userId, requested.requestId, AUDIT))).toBe('EXPORT_EXPIRED');

    // Requested once and downloaded once; the refused downloads left no row.
    const trail = await pool.query(
      `SELECT "eventType", "requestId", "ip", "userAgent" FROM "AccountAuditLog"
       WHERE "userId" = $1 ORDER BY "createdAt", "eventType"`,
      [a.userId],
    );

    expect(trail.rows.map((row) => row.eventType).sort()).toEqual([
      'export_downloaded',
      'export_requested',
    ]);
    expect(trail.rows.every((row) => row.requestId === requested.requestId)).toBe(true);
    expect(trail.rows[0]).toMatchObject({ ip: AUDIT.ip, userAgent: AUDIT.userAgent });
    expect(await count('AccountAuditLog', 'userId', b.userId)).toBe(0);
  });
});

describe('deletion and purge', () => {
  it('hides the member at once and restores them on cancel', async () => {
    const seen = await seed('female');
    const caller = await seed('male');
    const discovery = new PostgresDiscoveryRepository(db as any);

    expect(await discovery.findVisibleProfile(caller.userId, AGES, seen.profileRef)).not.toBeNull();

    const scheduled = await service.requestDeletion(seen.userId, PASSWORD, AUDIT);

    expect(scheduled.scheduledPurgeAt).toBe(
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
    expect(await discovery.findVisibleProfile(caller.userId, AGES, seen.profileRef)).toBeNull();

    // A repeated request keeps the first schedule and adds no second audit row.
    now = new Date(now.getTime() + 60 * 1000);
    expect((await service.requestDeletion(seen.userId, PASSWORD, AUDIT)).scheduledPurgeAt).toBe(
      scheduled.scheduledPurgeAt,
    );

    await service.cancelDeletion(seen.userId, AUDIT);

    const trail = await pool.query(
      `SELECT "eventType" FROM "AccountAuditLog" WHERE "userId" = $1 ORDER BY "createdAt", "eventType"`,
      [seen.userId],
    );

    expect(trail.rows.map((row) => row.eventType).sort()).toEqual([
      'deletion_cancelled',
      'deletion_requested',
    ]);

    expect(await discovery.findVisibleProfile(caller.userId, AGES, seen.profileRef)).not.toBeNull();
    expect((await pool.query(`SELECT "accountStatus" FROM "Users" WHERE "id" = $1`, [seen.userId])).rows[0].accountStatus).toBe('active');
  });

  it('removes personal rows at the boundary, keeps stripped evidence, and does nothing the day before', async () => {
    const admin = await pool.query(
      `INSERT INTO "Users" ("name", "email", "passwordHash", "mobile", "role", "mobileVerified")
       VALUES ('Admin', $1, 'x', $2, 'admin', true) RETURNING "id"`,
      [`admin-${tag}@itest.example`, `A${tagDigits}`],
    );
    const member = await seed('female', 'Leaving Member');
    const other = await seed('male', 'Staying Member');

    await pool.query(
      `INSERT INTO "UserSessions" ("userId", "refreshTokenHash", "refreshTokenExpiresAt")
       VALUES ($1, 'h', now() + interval '30 days')`,
      [member.userId],
    );
    await pool.query(
      `INSERT INTO "ProfilePhotos" ("userId", "fileUrl") VALUES ($1, 'p.jpg')`,
      [member.userId],
    );
    const kyc = await pool.query(
      `INSERT INTO "KycVerifications" ("userId", "status", "providerSessionId")
       VALUES ($1, 'needsReview', 's') RETURNING "id"`,
      [member.userId],
    );
    await pool.query(
      `INSERT INTO "KycMedia" ("id", "verificationId", "userId", "purpose", "contentType", "sizeBytes", "storageKey")
       VALUES ($1, $2, $3, 'kycId', 'image/jpeg', 10, $4)`,
      [randomUUID(), kyc.rows[0].id, member.userId, `kyc/${tag}/id.jpg`],
    );
    const sent = await pool.query(
      `INSERT INTO "Interests" ("senderId", "receiverId") VALUES ($1, $2) RETURNING "id"`,
      [member.userId, other.userId],
    );
    await pool.query(
      `INSERT INTO "InterestEvents" ("interestId", "actorId", "toStatus") VALUES ($1, $2, 'pending')`,
      [sent.rows[0].id, member.userId],
    );
    const received = await pool.query(
      `INSERT INTO "Interests" ("senderId", "receiverId", "status", "createdAt")
       VALUES ($1, $2, 'declined', now() - interval '1 day') RETURNING "id"`,
      [other.userId, member.userId],
    );
    const own = await pool.query(
      `INSERT INTO "ShortlistLists" ("userId", "name", "isDefault") VALUES ($1, 'Mine', true) RETURNING "id"`,
      [member.userId],
    );
    await pool.query(`INSERT INTO "ShortlistProfiles" ("listId", "targetId") VALUES ($1, $2)`, [own.rows[0].id, other.userId]);
    const theirs = await pool.query(
      `INSERT INTO "ShortlistLists" ("userId", "name", "isDefault") VALUES ($1, 'Theirs', true) RETURNING "id"`,
      [other.userId],
    );
    await pool.query(`INSERT INTO "ShortlistProfiles" ("listId", "targetId") VALUES ($1, $2)`, [theirs.rows[0].id, member.userId]);
    const conversation = await pool.query(
      `INSERT INTO "Conversations" ("user1Id", "user2Id") VALUES ($1, $2) RETURNING "id"`,
      [member.userId, other.userId],
    );
    await pool.query(
      `INSERT INTO "Messages" ("conversationId", "senderId", "content") VALUES ($1, $2, 'hello')`,
      [conversation.rows[0].id, member.userId],
    );
    await pool.query(
      `INSERT INTO "ProfileViews" ("viewerId", "viewedId", "viewedOn") VALUES ($1, $2, current_date)`,
      [other.userId, member.userId],
    );
    const consent = await pool.query(
      `INSERT INTO "ConsentRecords"
         ("userId", "userName", "code", "version", "documentHash", "textSnapshot", "language",
          "ip", "userAgent", "expiresAt", "source")
       VALUES ($1, 'Leaving Member', 'terms', '1.0', 'h', 'I agree', 'en', '10.0.0.9', 'UA/1', now() + interval '1 year', 'api')
       RETURNING "id"`,
      [member.userId],
    );
    const audit = await pool.query(
      `INSERT INTO "AdminAuditLog" ("adminId", "action", "targetId", "notes", "ipAddress", "userAgent", "reasonCode")
       VALUES ($1, 'APPROVE_PROFILE', $2, 'Approved Leaving Member', '10.0.0.7', 'AdminUA', 'ID_VALID')
       RETURNING "id"`,
      [admin.rows[0].id, member.userId],
    );
    const exportRequest = await service.requestExport(member.userId, PASSWORD, AUDIT);

    expect(exportRequest.status).toBe('pending');
    await service.logoutAll(member.userId, AUDIT);

    const requestedAt = new Date();

    now = requestedAt;
    const scheduled = await service.requestDeletion(member.userId, PASSWORD, AUDIT);
    const purgesBefore = await pool.query(
      `SELECT count(*)::int AS n FROM "AccountAuditLog" WHERE "eventType" = 'purge_executed'`,
    );
    const boundary = new Date(scheduled.scheduledPurgeAt);

    // Day before the boundary: nothing is removed.
    const early = await purge.run(new Date(boundary.getTime() - 24 * 60 * 60 * 1000));

    expect(early.purged).toBe(0);
    expect(await count('Users', 'id', member.userId)).toBe(1);
    expect(await count('Interests', 'senderId', member.userId)).toBe(1);
    expect(removedKeys).toEqual([]);

    // At the boundary: the member goes.
    const result = await purge.run(boundary);

    expect(result).toEqual({ purged: 1, failed: 0 });
    expect(removedKeys).toEqual([`kyc/${tag}/id.jpg`]);

    for (const [table, column] of [
      ['Users', 'id'],
      ['Profiles', 'userId'],
      ['UserSessions', 'userId'],
      ['ProfilePhotos', 'userId'],
      ['KycVerifications', 'userId'],
      ['KycMedia', 'userId'],
      ['Interests', 'senderId'],
      ['Interests', 'receiverId'],
      ['InterestEvents', 'actorId'],
      ['ShortlistLists', 'userId'],
      ['ShortlistProfiles', 'targetId'],
      ['Conversations', 'user1Id'],
      ['ProfileViews', 'viewedId'],
      ['AccountExportRequests', 'userId'],
    ] as const) {
      expect([table, column, await count(table, column, member.userId)]).toEqual([table, column, 0]);
    }

    expect(await count('Interests', 'id', received.rows[0].id)).toBe(0);
    expect(await count('ShortlistLists', 'id', theirs.rows[0].id)).toBe(1);
    expect(await count('ShortlistProfiles', 'listId', theirs.rows[0].id)).toBe(0);
    expect(await count('Users', 'id', other.userId)).toBe(1);

    // Kept with identity stripped.
    const keptConsent = await pool.query(`SELECT * FROM "ConsentRecords" WHERE "id" = $1`, [consent.rows[0].id]);

    expect(keptConsent.rows).toHaveLength(1);
    expect(keptConsent.rows[0]).toMatchObject({
      userId: null,
      userName: '',
      ip: '',
      userAgent: '',
      code: 'terms',
      version: '1.0',
      textSnapshot: 'I agree',
    });

    // The member's account events stay, with the member link, ip and user
    // agent cleared; the purge added one row of its own.
    const keptEvents = await pool.query(
      `SELECT "eventType", "userId", "ip", "userAgent", "requestId" FROM "AccountAuditLog"
       WHERE "requestId" = $1 OR ("eventType" IN ('logout_all', 'deletion_requested')
                                  AND "userId" IS NULL AND "createdAt" >= $2)`,
      [exportRequest.requestId, new Date(requestedAt.getTime() - 60 * 1000)],
    );
    const eventTypes = keptEvents.rows.map((row) => row.eventType);

    expect(eventTypes).toEqual(expect.arrayContaining(['export_requested', 'deletion_requested', 'logout_all']));
    expect(keptEvents.rows.every((row) => row.userId === null && row.ip === '' && row.userAgent === '')).toBe(true);
    expect(await count('AccountAuditLog', 'userId', member.userId)).toBe(0);

    const purgesAfter = await pool.query(
      `SELECT count(*)::int AS n FROM "AccountAuditLog" WHERE "eventType" = 'purge_executed' AND "userId" IS NULL`,
    );

    expect(purgesAfter.rows[0].n).toBe(purgesBefore.rows[0].n + 1);

    const keptAudit = await pool.query(`SELECT * FROM "AdminAuditLog" WHERE "id" = $1`, [audit.rows[0].id]);

    expect(keptAudit.rows).toHaveLength(1);
    expect(keptAudit.rows[0]).toMatchObject({
      targetId: null,
      relatedId: null,
      notes: null,
      ipAddress: null,
      userAgent: null,
      action: 'APPROVE_PROFILE',
      reasonCode: 'ID_VALID',
    });
  });

  it('cannot change consent evidence in any other way', async () => {
    const member = await seed('male');
    const record = await pool.query(
      `INSERT INTO "ConsentRecords"
         ("userId", "userName", "code", "version", "documentHash", "textSnapshot", "expiresAt")
       VALUES ($1, 'Keep Me', 'terms', '1.0', 'h', 'I agree', now() + interval '1 year') RETURNING "id"`,
      [member.userId],
    );

    await expect(
      pool.query(`UPDATE "ConsentRecords" SET "textSnapshot" = 'changed' WHERE "id" = $1`, [record.rows[0].id]),
    ).rejects.toThrow(/CONSENT_RECORDS_APPEND_ONLY/);
    await expect(
      pool.query(`UPDATE "ConsentRecords" SET "userId" = NULL, "userName" = '', "ip" = '', "userAgent" = '', "textSnapshot" = 'x' WHERE "id" = $1`, [record.rows[0].id]),
    ).rejects.toThrow(/CONSENT_RECORDS_APPEND_ONLY/);
    await expect(
      pool.query(`DELETE FROM "ConsentRecords" WHERE "id" = $1`, [record.rows[0].id]),
    ).rejects.toThrow(/CONSENT_RECORDS_APPEND_ONLY/);
  });

  const ANONYMISE = `UPDATE "ConsentRecords"
                     SET "userId" = NULL, "userName" = '', "ip" = '', "userAgent" = ''
                     WHERE "id" = $1`;

  it('refuses to anonymise a live member`s consent row, even with the permitted shape', async () => {
    const member = await seed('female');
    const record = await pool.query(
      `INSERT INTO "ConsentRecords"
         ("userId", "userName", "code", "version", "documentHash", "textSnapshot", "expiresAt")
       VALUES ($1, 'Live Member', 'terms', '1.0', 'h', 'I agree', now() + interval '1 year') RETURNING "id"`,
      [member.userId],
    );

    await expect(pool.query(ANONYMISE, [record.rows[0].id])).rejects.toThrow(/CONSENT_RECORDS_APPEND_ONLY/);

    // Naming the member as the purge target is not enough without a schedule.
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.purge_user_id', $1, true)`, [member.userId]);
      await expect(client.query(ANONYMISE, [record.rows[0].id])).rejects.toThrow(/CONSENT_RECORDS_APPEND_ONLY/);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }

    // A pending deletion alone, without the purge running, is not enough either.
    await service.requestDeletion(member.userId, PASSWORD, AUDIT);
    await expect(pool.query(ANONYMISE, [record.rows[0].id])).rejects.toThrow(/CONSENT_RECORDS_APPEND_ONLY/);

    const kept = await pool.query(`SELECT "userId", "userName" FROM "ConsentRecords" WHERE "id" = $1`, [record.rows[0].id]);

    expect(kept.rows[0]).toEqual({ userId: member.userId, userName: 'Live Member' });

    // Leave no due-in-30-days member behind for the purge test of the next run.
    await service.cancelDeletion(member.userId, AUDIT);
  });

  it('keeps the account audit log append-only', async () => {
    const member = await seed('male');

    await service.logoutAll(member.userId, AUDIT);

    await expect(
      pool.query(`UPDATE "AccountAuditLog" SET "eventType" = 'purge_executed' WHERE "userId" = $1`, [member.userId]),
    ).rejects.toThrow(/ACCOUNT_AUDIT_LOG_APPEND_ONLY/);
    await expect(
      pool.query(`UPDATE "AccountAuditLog" SET "userId" = NULL, "ip" = '', "userAgent" = '' WHERE "userId" = $1`, [member.userId]),
    ).rejects.toThrow(/ACCOUNT_AUDIT_LOG_APPEND_ONLY/);
    await expect(
      pool.query(`DELETE FROM "AccountAuditLog" WHERE "userId" = $1`, [member.userId]),
    ).rejects.toThrow(/ACCOUNT_AUDIT_LOG_APPEND_ONLY/);
    expect(await count('AccountAuditLog', 'userId', member.userId)).toBe(1);
  });
});
