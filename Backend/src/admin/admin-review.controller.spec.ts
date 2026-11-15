import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { RequestIdInterceptor } from '../common/request-id.interceptor';
import { FakeStorageProvider } from '../storage/fake-storage.provider';
import { OBJECT_STORAGE } from '../storage/object-storage';
import { AdminController } from './admin.controller';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminService } from './admin.service';
import { InMemoryReviewRepository } from './review/in-memory-review.repository';
import { REVIEW_CLOCK, REVIEW_REPOSITORY } from './review/review.repository';
import {
  AdminReviewService,
  REVIEW_AGE_MINIMUMS,
  REVIEW_BUSINESS_HOURS,
} from './review/review.service';
import type { ReviewSubject } from './review/review.types';

const ADMIN_SECRET = 'admin-secret-for-tests';
const MEMBER_SECRET = 'member-secret-for-tests';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FULL_ID = '123456789012';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';
const UNKNOWN = '99999999-9999-4999-8999-999999999999';

// Monday 2026-11-16 12:00 IST.
const NOW = new Date('2026-11-16T06:30:00.000Z');

function subject(userId: string, overrides: Partial<ReviewSubject> = {}): ReviewSubject {
  return {
    userId,
    profileUid: `UID-${userId.slice(0, 4)}`,
    name: `Member ${userId.slice(0, 2)}`,
    gender: 'male',
    dateOfBirth: '1995-05-05',
    accountStatus: 'pending',
    profileReviewStatus: 'submitted',
    kycStatus: 'needsReview',
    documentType: 'aadhaar',
    idNumberLast4: '9012',
    photo: { storageKey: `kyc/${userId}/photo`, contentType: 'image/jpeg' },
    idDocument: { storageKey: `kyc/${userId}/id`, contentType: 'image/png' },
    submittedAt: new Date('2026-11-09T03:30:00.000Z'),
    ...overrides,
  };
}

describe('Admin review (HTTP contract)', () => {
  let app: INestApplication;
  let repo: InMemoryReviewRepository;
  let jwt: JwtService;
  let adminToken: string;

  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://unused';
    process.env.JWT_SECRET = MEMBER_SECRET;
    process.env.JWT_REFRESH_SECRET = 'refresh';
    process.env.ADMIN_JWT_SECRET = ADMIN_SECRET;
  });

  beforeEach(async () => {
    repo = new InMemoryReviewRepository();
    jwt = new JwtService();
    adminToken = await jwt.signAsync(
      { sub: ADMIN_ID, email: 'admin@example.com', role: 'admin' },
      { secret: ADMIN_SECRET, expiresIn: '1h' },
    );

    const moduleRef = await Test.createTestingModule({
      imports: [],
      controllers: [AdminController],
      providers: [
        AdminReviewService,
        AdminJwtStrategy,
        { provide: JwtService, useValue: jwt },
        { provide: AdminService, useValue: {} },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: REVIEW_REPOSITORY, useValue: repo },
        { provide: OBJECT_STORAGE, useValue: new FakeStorageProvider(() => NOW) },
        { provide: REVIEW_CLOCK, useValue: () => NOW },
        {
          provide: REVIEW_BUSINESS_HOURS,
          useValue: {
            slaHours: 48,
            days: [1, 2, 3, 4, 5],
            startMinute: 540,
            endMinute: 1080,
            timeZone: 'Asia/Kolkata',
          },
        },
        { provide: REVIEW_AGE_MINIMUMS, useValue: { male: 21, female: 18 } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new RequestIdInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const as = (token: string | null, req: request.Test) =>
    token ? req.set('Authorization', `Bearer ${token}`) : req;
  const get = (path: string, token: string | null = adminToken) =>
    as(token, request(app.getHttpServer()).get(`/api/v1/admin/profiles${path}`));
  const patch = (path: string, body: object, token: string | null = adminToken) =>
    as(
      token,
      request(app.getHttpServer()).patch(`/api/v1/admin/profiles${path}`).send(body),
    );

  const post = (path: string, body: object, token: string | null = adminToken) =>
    as(
      token,
      request(app.getHttpServer()).post(`/api/v1/admin/profiles${path}`).send(body),
    );
  const rejected = (
    overrides: Partial<ReviewSubject> = {},
  ): Partial<ReviewSubject> => ({
    accountStatus: 'rejected',
    profileReviewStatus: 'rejected',
    kycStatus: 'failed',
    ...overrides,
  });

  describe('reopen (story 5 AC8)', () => {
    const body = { reasonCode: 'photo-mismatch', notes: 'Upload a new photo' };

    it('moves a rejected profile to needsChanges and writes one audit row', async () => {
      repo.addSubject(subject(U1, rejected()));

      const res = await post(`/${U1}/reopen`, body);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'needsChanges',
        statusBefore: 'rejected',
        statusAfter: 'needsChanges',
      });
      expect(repo.subjects[0]).toMatchObject({
        accountStatus: 'pending',
        profileReviewStatus: 'needsChanges',
      });
      expect(repo.auditLog).toHaveLength(1);
      expect(repo.auditLog[0]).toMatchObject({
        adminId: ADMIN_ID,
        targetId: U1,
        action: 'reopen',
        reasonCode: 'photo-mismatch',
        notes: 'Upload a new photo',
      });
    });

    it('needs no uploaded files, since the member may have restarted verification', async () => {
      repo.addSubject(
        subject(U1, rejected({ photo: null, idDocument: null, kycStatus: 'consentGiven' })),
      );

      const res = await post(`/${U1}/reopen`, body);

      expect(res.status).toBe(200);
      expect(repo.subjects[0].kycStatus).toBe('consentGiven');
    });

    it.each(['draft', 'submitted', 'approved', 'needsChanges'] as const)(
      'answers 409 from %s and writes no audit row',
      async (status) => {
        repo.addSubject(subject(U1, { profileReviewStatus: status }));

        const res = await post(`/${U1}/reopen`, body);

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
        expect(repo.auditLog).toHaveLength(0);
        expect(repo.subjects[0].profileReviewStatus).toBe(status);
      },
    );

    it('answers 404 for an unknown member', async () => {
      expect((await post(`/${UNKNOWN}/reopen`, body)).status).toBe(404);
    });

    it.each([{}, { notes: 'x' }, { reasonCode: 'because', notes: 'x' }])(
      'answers 400 for a missing or invalid reason code (%j)',
      async (payload) => {
        repo.addSubject(subject(U1, rejected()));

        const res = await post(`/${U1}/reopen`, payload);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_REASON_CODE');
        expect(repo.auditLog).toHaveLength(0);
      },
    );

    it.each(['status', 'accountStatus', 'profileReviewStatus', 'adminId', 'sections'])(
      'answers 400 when the body carries %s',
      async (key) => {
        repo.addSubject(subject(U1, rejected()));

        const res = await post(`/${U1}/reopen`, { ...body, [key]: 'x' });

        expect(res.status).toBe(400);
        expect(repo.subjects[0].profileReviewStatus).toBe('rejected');
      },
    );

    it('answers 401 without a token and 403 for a member token', async () => {
      repo.addSubject(subject(U1, rejected()));
      const member = await jwt.signAsync(
        { sub: U1, email: 'm@example.com', role: 'user' },
        { secret: MEMBER_SECRET, expiresIn: '1h' },
      );

      expect((await post(`/${U1}/reopen`, body, null)).status).toBe(401);
      expect((await post(`/${U1}/reopen`, body, member)).status).toBe(403);
      expect(repo.auditLog).toHaveLength(0);
    });
  });

  describe('queue (AC1)', () => {
    it('lists the oldest submission first with an SLA reading', async () => {
      repo.addSubject(
        subject(U2, { submittedAt: new Date('2026-11-12T12:30:00.000Z') }),
      );
      repo.addSubject(subject(U1));
      repo.addSubject(subject(U3, { photo: null, submittedAt: null }));

      const res = await get('/pending');

      expect(res.status).toBe(200);
      expect(res.body.profiles.map((p: { userId: string }) => p.userId)).toEqual([
        U1,
        U2,
      ]);
      expect(res.body.profiles[0]).toEqual({
        userId: U1,
        profileUid: 'UID-1111',
        name: 'Member 11',
        submittedAt: '2026-11-09T03:30:00.000Z',
        slaRemainingHours: 0,
        slaState: 'overdue',
      });
      // Thursday 18:00 to Monday 12:00 is Friday's 9 hours plus Monday's 3.
      expect(res.body.profiles[1].slaState).toBe('ok');
      expect(res.body.profiles[1].slaRemainingHours).toBe(36);
    });
  });

  describe('queue after withdraw (story 5 AC3)', () => {
    it('lists only profiles whose review status is submitted', async () => {
      repo.addSubject(subject(U1));
      repo.addSubject(subject(U2, { profileReviewStatus: 'draft', submittedAt: null }));

      const res = await get('/pending');

      expect(res.body.profiles.map((p: { userId: string }) => p.userId)).toEqual([U1]);
    });
  });

  describe('workspace (AC2, AC3)', () => {
    it('returns the masked ID, the age check and short-lived references', async () => {
      repo.addSubject(subject(U1));

      const res = await get(`/${U1}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        userId: U1,
        name: 'Member 11',
        dateOfBirth: '1995-05-05',
        age: 31,
        ageCheck: 'pass',
        documentType: 'aadhaar',
        idNumberMasked: '****9012',
        idDocument: {
          href: `/api/v1/admin/profiles/${U1}/id-document`,
          contentType: 'image/png',
        },
      });
      expect(res.body.photo.url).toContain('https://fake-storage.invalid/');
      expect(JSON.stringify(res.body)).not.toContain(FULL_ID);
      expect(repo.auditLog).toHaveLength(0);
      expect(repo.subjects[0].accountStatus).toBe('pending');
    });

    it('fails the age check for a man under 21 and a woman under 18', async () => {
      repo.addSubject(subject(U1, { dateOfBirth: '2010-01-01', gender: 'female' }));
      repo.addSubject(subject(U2, { dateOfBirth: '2007-06-01', gender: 'male' }));

      expect((await get(`/${U1}`)).body.ageCheck).toBe('fail');
      expect((await get(`/${U2}`)).body).toMatchObject({ ageCheck: 'fail', age: 19 });
    });

    it('answers 404 for an unknown member and 400 for a malformed id', async () => {
      const missing = await get(`/${UNKNOWN}`);
      const malformed = await get('/not-a-uuid');

      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('NOT_FOUND');
      expect(malformed.status).toBe(400);
      expect(malformed.body.details.fields.userId).toBeDefined();
    });

    it('audits every ID view and leaves the status alone', async () => {
      repo.addSubject(subject(U1));

      const first = await get(`/${U1}/id-document`)
        .set('x-request-id', 'req-1')
        .set('user-agent', 'jest-agent');
      await get(`/${U1}/id-document`);

      expect(first.status).toBe(200);
      expect(first.body.url).toContain('fake-storage.invalid');
      expect(repo.auditLog).toHaveLength(2);
      expect(repo.auditLog[0]).toMatchObject({
        adminId: ADMIN_ID,
        targetId: U1,
        action: 'VIEW_DOCUMENT',
        requestId: 'req-1',
        userAgent: 'jest-agent',
      });
      expect(repo.auditLog[0].ip).not.toBe('');
      expect(repo.subjects[0].accountStatus).toBe('pending');
    });
  });

  describe('decisions (AC4, AC5, AC6)', () => {
    it('approves without a reason code and writes one audit row', async () => {
      repo.addSubject(subject(U1));

      const res = await patch(`/${U1}/approve`, { notes: 'looks good' });

      expect(res.status).toBe(200);
      expect(repo.auditLog).toHaveLength(1);
      expect(repo.auditLog[0]).toMatchObject({
        adminId: ADMIN_ID,
        targetId: U1,
        action: 'APPROVE_PROFILE',
        reasonCode: null,
        notes: 'looks good',
        statusBefore: 'needsReview',
        statusAfter: 'approved',
      });
      expect(repo.subjects[0]).toMatchObject({
        accountStatus: 'active',
        profileReviewStatus: 'approved',
        kycStatus: 'approved',
      });
    });

    it('rejects an approve with an unknown reason code', async () => {
      repo.addSubject(subject(U1));

      const res = await patch(`/${U1}/approve`, { reasonCode: 'nope' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REASON_CODE');
    });

    it('requires a known reason code on reject and lists the allowed ones', async () => {
      repo.addSubject(subject(U1));

      const missing = await patch(`/${U1}/reject`, {});
      const unknown = await patch(`/${U1}/reject`, { reasonCode: 'because' });

      for (const res of [missing, unknown]) {
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_REASON_CODE');
        expect(res.body.details.allowed).toHaveLength(11);
      }
      expect(repo.auditLog).toHaveLength(0);
    });

    it('rejects with a reason code and moves the case to failed', async () => {
      repo.addSubject(subject(U1));

      const res = await patch(`/${U1}/reject`, {
        reasonCode: 'under-age',
        notes: 'DOB on ID shows 17',
      });

      expect(res.status).toBe(200);
      expect(repo.subjects[0]).toMatchObject({
        accountStatus: 'rejected',
        profileReviewStatus: 'rejected',
        kycStatus: 'failed',
      });
      expect(repo.auditLog[0]).toMatchObject({
        action: 'REJECT_PROFILE',
        reasonCode: 'under-age',
        statusAfter: 'failed',
      });
    });

    it('accepts notes of exactly 500 characters and refuses 501', async () => {
      repo.addSubject(subject(U1));
      repo.addSubject(subject(U2));

      const over = await patch(`/${U1}/reject`, {
        reasonCode: 'other',
        notes: 'x'.repeat(501),
      });
      const exact = await patch(`/${U2}/reject`, {
        reasonCode: 'other',
        notes: 'x'.repeat(500),
      });

      expect(over.status).toBe(400);
      expect(exact.status).toBe(200);
    });

    it('requests changes with reason, notes and flagged sections', async () => {
      repo.addSubject(subject(U1));

      const res = await patch(`/${U1}/request-changes`, {
        reasonCode: 'photo-mismatch',
        notes: '  Upload a clearer photo  ',
        sections: ['step-1', 'step-3'],
      });

      expect(res.status).toBe(200);
      expect(repo.decisions.get(U1)).toEqual({
        decision: 'requestChanges',
        reasonCode: 'photo-mismatch',
        notes: 'Upload a clearer photo',
        sections: ['step-1', 'step-3'],
      });
      expect(repo.subjects[0]).toMatchObject({
        accountStatus: 'pending',
        profileReviewStatus: 'needsChanges',
        kycStatus: 'changesNeeded',
      });
      expect(repo.auditLog[0].action).toBe('REQUEST_CHANGES');
    });

    it.each([
      ['empty notes', { reasonCode: 'other', notes: '   ', sections: ['step-1'] }],
      ['no notes', { reasonCode: 'other', sections: ['step-1'] }],
      ['empty sections', { reasonCode: 'other', notes: 'fix', sections: [] }],
      ['unknown section', { reasonCode: 'other', notes: 'fix', sections: ['step-9'] }],
    ])('refuses request-changes with %s', async (_label, body) => {
      repo.addSubject(subject(U1));

      const res = await patch(`/${U1}/request-changes`, body);

      expect(res.status).toBe(400);
      expect(repo.auditLog).toHaveLength(0);
    });

    it.each(['under-age', 'duplicate-account', 'duplicate account'])(
      'refuses reason code %s on request-changes',
      async (reasonCode) => {
        repo.addSubject(subject(U1));

        const res = await patch(`/${U1}/request-changes`, {
          reasonCode,
          notes: 'fix',
          sections: ['step-1'],
        });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_REASON_CODE');
      },
    );

    it.each([
      [
        'already approved',
        { accountStatus: 'active', profileReviewStatus: 'approved', kycStatus: 'approved' },
      ],
      [
        'already rejected',
        { accountStatus: 'rejected', profileReviewStatus: 'rejected', kycStatus: 'failed' },
      ],
      ['blocked', { accountStatus: 'blocked' }],
      [
        'never submitted',
        {
          profileReviewStatus: 'draft',
          kycStatus: null,
          photo: null,
          idDocument: null,
          submittedAt: null,
        },
      ],
    ])('answers 409 for a decision on a profile that is %s', async (_label, state) => {
      repo.addSubject(subject(U1, state as Partial<ReviewSubject>));
      const before = JSON.stringify(repo.subjects[0]);

      for (const [path, body] of [
        ['approve', {}],
        ['reject', { reasonCode: 'other' }],
        [
          'request-changes',
          { reasonCode: 'other', notes: 'fix', sections: ['step-1'] },
        ],
      ] as const) {
        const res = await patch(`/${U1}/${path}`, body);

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
      }

      expect(repo.auditLog).toHaveLength(0);
      expect(JSON.stringify(repo.subjects[0])).toBe(before);
    });

    it('answers 404 when the member does not exist', async () => {
      const res = await patch(`/${UNKNOWN}/approve`, {});

      expect(res.status).toBe(404);
    });

    it('decides only once: the second decision is a 409', async () => {
      repo.addSubject(subject(U1));

      await patch(`/${U1}/approve`, {});
      const again = await patch(`/${U1}/reject`, { reasonCode: 'other' });

      expect(again.status).toBe(409);
      expect(repo.auditLog).toHaveLength(1);
    });
  });

  describe('authorization (AC7)', () => {
    const calls: [string, (token: string | null) => request.Test][] = [
      ['queue', (t) => get('/pending', t)],
      ['workspace', (t) => get(`/${U1}`, t)],
      ['id document', (t) => get(`/${U1}/id-document`, t)],
      ['approve', (t) => patch(`/${U1}/approve`, {}, t)],
      ['reject', (t) => patch(`/${U1}/reject`, { reasonCode: 'other' }, t)],
      [
        'request-changes',
        (t) =>
          patch(
            `/${U1}/request-changes`,
            { reasonCode: 'other', notes: 'n', sections: ['step-1'] },
            t,
          ),
      ],
    ];

    beforeEach(() => repo.addSubject(subject(U1)));

    it.each(calls)('%s: 401 without a token', async (_name, call) => {
      expect((await call(null)).status).toBe(401);
    });

    it.each(calls)('%s: 403 for a member token', async (_name, call) => {
      const member = await jwt.signAsync(
        { sub: U1, email: 'm@example.com', role: 'user' },
        { secret: MEMBER_SECRET, expiresIn: '1h' },
      );

      expect((await call(member)).status).toBe(403);
    });

    it.each(calls)('%s: 401 for an expired admin token', async (_name, call) => {
      const expired = await jwt.signAsync(
        { sub: ADMIN_ID, email: 'admin@example.com', role: 'admin' },
        { secret: ADMIN_SECRET, expiresIn: '-1h' },
      );

      expect((await call(expired)).status).toBe(401);
    });

    it('changes nothing when a member token calls approve on its own profile', async () => {
      const member = await jwt.signAsync(
        { sub: U1, email: 'm@example.com', role: 'user' },
        { secret: MEMBER_SECRET, expiresIn: '1h' },
      );

      await patch(`/${U1}/approve`, {}, member);

      expect(repo.subjects[0].accountStatus).toBe('pending');
      expect(repo.auditLog).toHaveLength(0);
    });

    it.each(['accountStatus', 'role', 'idVerified'])(
      'refuses %s in a decision body',
      async (key) => {
        const res = await patch(`/${U1}/approve`, { [key]: 'active' });

        expect(res.status).toBe(400);
        expect(repo.subjects[0].accountStatus).toBe('pending');
      },
    );
  });
});
