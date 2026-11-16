import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import {
  ACCOUNT_CLOCK,
  ACCOUNT_CONFIG,
  ACCOUNT_REPOSITORY,
  NOTIFICATION_KEYS,
  STEP_UP_REPOSITORY,
  type AccountRepository,
  type AccountSettings,
  type ExportRequestRecord,
  type FailureWindow,
  type StepUpRepository,
} from './account.types';
import { StepUpService } from './step-up.service';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const PASSWORD = 'Correct-horse-1';

class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.headers['x-test-user'];

    if (!user) {
      throw new UnauthorizedException();
    }

    req.user = { sub: user, email: 'a@example.com', role: 'user' };

    return true;
  }
}

/** In-memory stand-in for the two Postgres repositories. */
class InMemoryAccount implements AccountRepository, StepUpRepository {
  settings = new Map<string, AccountSettings>();
  exports: (ExportRequestRecord & { userId: string })[] = [];
  deletions = new Map<string, { requestedAt: Date; scheduledPurgeAt: Date }>();
  failures: { userId: string; at: Date }[] = [];
  revoked: string[] = [];
  hash = bcrypt.hashSync(PASSWORD, 4);
  private seq = 0;

  async getSettings(userId: string) {
    if (!this.settings.has(userId)) {
      this.settings.set(userId, {
        language: 'en',
        notifications: Object.fromEntries(
          NOTIFICATION_KEYS.map((key) => [key, true]),
        ) as AccountSettings['notifications'],
        profileVisibility: 'all',
      });
    }

    return this.settings.get(userId)!;
  }

  async updateSettings(userId: string, patch: any) {
    const current = await this.getSettings(userId);
    const next = {
      language: patch.language ?? current.language,
      profileVisibility: patch.profileVisibility ?? current.profileVisibility,
      notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
    };

    this.settings.set(userId, next);

    return next;
  }

  async revokeAllSessions(userId: string) {
    this.revoked.push(userId);
  }

  async createExportRequest(userId: string, now: Date, expiresAt: Date) {
    const pending = this.exports.some(
      (item) =>
        item.userId === userId &&
        item.status === 'pending' &&
        item.expiresAt.getTime() > now.getTime(),
    );

    if (pending) {
      return { kind: 'alreadyPending' as const };
    }

    this.seq += 1;
    const request = {
      id: `00000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`,
      userId,
      status: 'pending' as const,
      requestedAt: now,
      expiresAt,
      archive: null,
    };

    this.exports.push(request);

    return { kind: 'created' as const, request };
  }

  async findExportRequest(userId: string, requestId: string) {
    return (
      this.exports.find((item) => item.id === requestId && item.userId === userId) ??
      null
    );
  }

  async buildExportArchive(userId: string, now: Date) {
    return { format: 'dhobi-matrimony-export', owner: userId, exportedAt: now.toISOString() };
  }

  async storeExportArchive(requestId: string, archive: any) {
    const found = this.exports.find((item) => item.id === requestId)!;

    found.archive = archive;
    found.status = 'ready';

    return found;
  }

  async scheduleDeletion(userId: string, requestedAt: Date, purgeAt: Date) {
    if (this.deletions.has(userId)) {
      return { kind: 'alreadyPending' as const };
    }

    const state = { requestedAt, scheduledPurgeAt: purgeAt };

    this.deletions.set(userId, state);

    return { kind: 'scheduled' as const, state };
  }

  async findDeletion(userId: string) {
    return this.deletions.get(userId) ?? null;
  }

  async cancelDeletion(userId: string) {
    this.deletions.delete(userId);
  }

  async findPasswordHash() {
    return this.hash;
  }

  async failuresSince(userId: string, since: Date): Promise<FailureWindow> {
    const mine = this.failures
      .filter((item) => item.userId === userId && item.at.getTime() > since.getTime())
      .map((item) => item.at.getTime());

    return {
      count: mine.length,
      oldestAt: mine.length ? new Date(Math.min(...mine)) : null,
    };
  }

  async recordFailure(userId: string, at: Date) {
    this.failures.push({ userId, at });
  }
}

describe('AccountController (HTTP contract)', () => {
  let app: INestApplication;
  let store: InMemoryAccount;
  let now: Date;

  beforeEach(async () => {
    now = new Date('2026-11-16T10:00:00.000Z');
    store = new InMemoryAccount();

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [
        AccountService,
        StepUpService,
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: ACCOUNT_REPOSITORY, useValue: store },
        { provide: STEP_UP_REPOSITORY, useValue: store },
        {
          provide: ACCOUNT_CONFIG,
          useValue: {
            deletionCoolingOffDays: 30,
            exportLinkHours: 24,
            stepUpMaxFailures: 5,
            stepUpWindowMinutes: 15,
          },
        },
        { provide: ACCOUNT_CLOCK, useValue: () => now },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new HeaderAuthGuard())
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function call(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    user: string | null,
    body?: object,
  ) {
    let req = request(app.getHttpServer())[method](`/api/v1/account${path}`);

    if (user) {
      req = req.set('x-test-user', user);
    }

    return body ? req.send(body) : req;
  }

  describe('settings', () => {
    it('returns the three setting groups', async () => {
      const response = await call('get', '/settings', USER_A);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
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
    });

    it('requires a token', async () => {
      expect((await call('get', '/settings', null)).status).toBe(401);
      expect((await call('patch', '/settings', null, { language: 'hi' })).status).toBe(401);
    });

    it.each(['en', 'hi', 'gu'])('persists language %s', async (language) => {
      const patched = await call('patch', '/settings', USER_A, { language });

      expect(patched.status).toBe(200);
      expect((await call('get', '/settings', USER_A)).body.language).toBe(language);
    });

    it('rejects an unsupported language with a field-level error', async () => {
      const response = await call('patch', '/settings', USER_A, { language: 'fr' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(response.body.details.issues)).toContain('language');
    });

    it.each([{ role: 'admin' }, { accountStatus: 'active' }, { id: USER_B }])(
      'rejects the unknown key %j',
      async (body) => {
        const response = await call('patch', '/settings', USER_A, body);

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      },
    );

    it('rejects an unknown notification key and a non-boolean value', async () => {
      expect(
        (await call('patch', '/settings', USER_A, { notifications: { sms: true } })).status,
      ).toBe(400);
      expect(
        (await call('patch', '/settings', USER_A, { notifications: { newMessage: 'no' } }))
          .status,
      ).toBe(400);
    });

    it('merges notification flags and never touches another member', async () => {
      await call('patch', '/settings', USER_A, {
        notifications: { newMessage: false },
        profileVisibility: 'hidden',
      });

      const mine = await call('get', '/settings', USER_A);
      const theirs = await call('get', '/settings', USER_B);

      expect(mine.body.notifications.newMessage).toBe(false);
      expect(mine.body.notifications.interestReceived).toBe(true);
      expect(mine.body.profileVisibility).toBe('hidden');
      expect(theirs.body.notifications.newMessage).toBe(true);
      expect(theirs.body.profileVisibility).toBe('all');
    });
  });

  describe('logout-all', () => {
    it('revokes the caller only', async () => {
      const response = await call('post', '/logout-all', USER_A);

      expect(response.status).toBe(200);
      expect(store.revoked).toEqual([USER_A]);
    });

    it('requires a token', async () => {
      expect((await call('post', '/logout-all', null)).status).toBe(401);
      expect(store.revoked).toEqual([]);
    });
  });

  describe('export', () => {
    it('refuses a wrong password and creates no request', async () => {
      const response = await call('post', '/export-request', USER_A, { password: 'nope' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('STEP_UP_FAILED');
      expect(store.exports).toHaveLength(0);
    });

    it('requires the password field and rejects extra fields', async () => {
      expect((await call('post', '/export-request', USER_A, {})).status).toBe(400);
      expect(
        (await call('post', '/export-request', USER_A, { password: PASSWORD, userId: USER_B }))
          .status,
      ).toBe(400);
    });

    it('accepts with the correct password and then reports a pending one', async () => {
      const first = await call('post', '/export-request', USER_A, { password: PASSWORD });

      expect(first.status).toBe(202);
      expect(first.body.status).toBe('pending');
      expect(first.body.requestId).toEqual(expect.any(String));
      expect(first.body.expiresAt).toBe('2026-11-17T10:00:00.000Z');

      const second = await call('post', '/export-request', USER_A, { password: PASSWORD });

      expect(second.status).toBe(409);
      expect(second.body.code).toBe('REQUEST_ALREADY_PENDING');
    });

    it('rate limits after 5 failed attempts in 15 minutes, even for the right password', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const failed = await call('post', '/export-request', USER_A, { password: 'bad' });

        expect(failed.status).toBe(403);
      }

      const limited = await call('post', '/export-request', USER_A, { password: PASSWORD });

      expect(limited.status).toBe(429);
      expect(limited.body.code).toBe('RATE_LIMITED');
      expect(limited.headers['retry-after']).toBe('900');
      expect(store.exports).toHaveLength(0);

      now = new Date(now.getTime() + 16 * 60 * 1000);

      expect(
        (await call('post', '/export-request', USER_A, { password: PASSWORD })).status,
      ).toBe(202);
    });

    it('counts failures per member', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await call('post', '/export-request', USER_A, { password: 'bad' });
      }

      expect(
        (await call('post', '/export-request', USER_B, { password: PASSWORD })).status,
      ).toBe(202);
    });

    it('serves the archive only to the owner while the link is valid', async () => {
      const created = await call('post', '/export-request', USER_A, { password: PASSWORD });
      const path = `/export/${created.body.requestId}`;

      expect((await call('get', path, null)).status).toBe(401);

      const other = await call('get', path, USER_B);

      expect(other.status).toBe(404);
      expect(other.body.code).toBe('EXPORT_NOT_FOUND');

      const mine = await call('get', path, USER_A);

      expect(mine.status).toBe(200);
      expect(mine.body.owner).toBe(USER_A);
      expect(mine.headers['cache-control']).toBe('private, no-store');

      now = new Date('2026-11-17T09:59:59.000Z');
      expect((await call('get', path, USER_A)).status).toBe(200);

      now = new Date('2026-11-17T10:00:00.000Z');

      const expired = await call('get', path, USER_A);

      expect(expired.status).toBe(410);
      expect(expired.body.code).toBe('EXPORT_EXPIRED');
    });

    it('treats a malformed request id as not found', async () => {
      expect((await call('get', '/export/not-a-uuid', USER_A)).status).toBe(404);
    });
  });

  describe('delete request', () => {
    it('refuses a wrong password', async () => {
      const response = await call('post', '/delete-request', USER_A, { password: 'nope' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('STEP_UP_FAILED');
      expect(store.deletions.size).toBe(0);
    });

    it('schedules the purge 30 days out', async () => {
      const response = await call('post', '/delete-request', USER_A, { password: PASSWORD });

      expect(response.status).toBe(202);
      expect(response.body.status).toBe('pending');
      expect(response.body.scheduledPurgeAt).toBe('2026-12-16T10:00:00.000Z');
    });

    it('refuses a second request while one is pending', async () => {
      await call('post', '/delete-request', USER_A, { password: PASSWORD });

      const second = await call('post', '/delete-request', USER_A, { password: PASSWORD });

      expect(second.status).toBe(409);
      expect(second.body.code).toBe('REQUEST_ALREADY_PENDING');
    });

    it('cancels within the cooling-off and then finds nothing to cancel', async () => {
      await call('post', '/delete-request', USER_A, { password: PASSWORD });

      now = new Date('2026-12-15T10:00:00.000Z');

      expect((await call('delete', '/delete-request', USER_A)).status).toBe(200);

      const again = await call('delete', '/delete-request', USER_A);

      expect(again.status).toBe(404);
      expect(again.body.code).toBe('DELETE_REQUEST_NOT_FOUND');
    });

    it('answers 410 ACCOUNT_PURGED once the boundary has passed', async () => {
      await call('post', '/delete-request', USER_A, { password: PASSWORD });

      now = new Date('2026-12-16T10:00:00.000Z');

      const response = await call('delete', '/delete-request', USER_A);

      expect(response.status).toBe(410);
      expect(response.body.code).toBe('ACCOUNT_PURGED');
      expect(store.deletions.has(USER_A)).toBe(true);
    });

    it('cannot cancel another member`s request', async () => {
      await call('post', '/delete-request', USER_A, { password: PASSWORD });

      expect((await call('delete', '/delete-request', USER_B)).status).toBe(404);
      expect(store.deletions.has(USER_A)).toBe(true);
    });
  });
});
