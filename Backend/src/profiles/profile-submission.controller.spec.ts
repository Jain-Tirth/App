import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscoveryService } from '../discovery/discovery.service';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { InMemoryProfileSubmissionRepository } from './in-memory-profile-submission.repository';
import {
  PROFILE_STATUS_READER,
  PROFILE_SUBMISSION_REPOSITORY,
  type SubmissionState,
} from './profile-submission.repository';
import {
  ApprovedProfileGuard,
  EditableProfileGuard,
} from './profile-status.guards';
import {
  PROFILE_REVIEW_STATUSES,
  type ProfileReviewStatus,
} from './profile-status';
import {
  ProfileSubmissionService,
  SUBMISSION_AGE_MINIMUMS,
  SUBMISSION_CLOCK,
  SUBMISSION_CONSENT_GATE,
} from './profile-submission.service';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

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

function member(
  status: ProfileReviewStatus,
  overrides: Partial<SubmissionState['facts']> = {},
  submittedAt: Date | null = null,
): SubmissionState {
  return {
    accountStatus: status === 'approved' ? 'active' : 'pending',
    profileReviewStatus: status,
    submittedAt,
    facts: {
      completedSteps: ['step-1', 'step-2', 'step-3', 'step-4', 'step-5'],
      gender: 'male',
      dateOfBirth: '1995-05-05',
      kycStatus: 'needsReview',
      hasPhoto: true,
      hasIdDocument: true,
      ...overrides,
    },
  };
}

describe('Profile submission and gating (HTTP contract)', () => {
  let app: INestApplication;
  let repo: InMemoryProfileSubmissionRepository;
  let consentValid: boolean;
  let now: Date;
  const profilesService = {
    getMyProfile: jest.fn().mockResolvedValue({ profile: null }),
    savePersonalDetails: jest.fn().mockResolvedValue({ saved: true }),
    saveReligiousDetails: jest.fn().mockResolvedValue({ saved: true }),
    saveLocationDetails: jest.fn().mockResolvedValue({ saved: true }),
    saveProfessionalDetails: jest.fn().mockResolvedValue({ saved: true }),
    saveAdditionalDetails: jest.fn().mockResolvedValue({ saved: true }),
  };

  beforeEach(async () => {
    consentValid = true;
    now = new Date('2026-11-14T10:00:00.000Z');
    repo = new InMemoryProfileSubmissionRepository();

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        ProfileSubmissionService,
        ApprovedProfileGuard,
        EditableProfileGuard,
        { provide: ProfilesService, useValue: profilesService },
        {
          provide: DiscoveryService,
          useValue: { matches: async () => ({ total: 0, matches: [] }) },
        },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: PROFILE_SUBMISSION_REPOSITORY, useValue: repo },
        { provide: PROFILE_STATUS_READER, useValue: repo },
        {
          provide: SUBMISSION_CONSENT_GATE,
          useValue: { hasValidRequiredConsents: async () => consentValid },
        },
        { provide: SUBMISSION_CLOCK, useValue: () => now },
        { provide: SUBMISSION_AGE_MINIMUMS, useValue: { male: 21, female: 18 } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new HeaderAuthGuard())
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
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

  const call = (
    method: 'get' | 'post' | 'put',
    path: string,
    user: string | null = USER,
    body?: object,
  ) => {
    let req = request(app.getHttpServer())[method](`/api/v1/profiles${path}`);

    if (user) {
      req = req.set('x-test-user', user);
    }

    return body ? req.send(body) : req;
  };

  describe('submit (AC1, AC2, AC4)', () => {
    it('moves a complete draft to submitted and stamps submittedAt', async () => {
      repo.addMember(USER, member('draft'));

      const res = await call('post', '/submit');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'submitted',
        submittedAt: '2026-11-14T10:00:00.000Z',
      });
      expect(repo.members.get(USER)).toMatchObject({
        profileReviewStatus: 'submitted',
        accountStatus: 'pending',
      });
    });

    it('names every missing item and leaves the status alone', async () => {
      consentValid = false;
      repo.addMember(
        USER,
        member('draft', {
          completedSteps: ['step-1', 'step-2', 'step-4', 'step-5'],
          hasPhoto: false,
          hasIdDocument: false,
          kycStatus: 'consentGiven',
        }),
      );

      const res = await call('post', '/submit');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SUBMISSION_INCOMPLETE');
      expect(res.body.details.missing).toEqual([
        'step-3',
        'consent',
        'kycPhoto',
        'kycId',
      ]);
      expect(repo.members.get(USER)?.profileReviewStatus).toBe('draft');
    });

    it('reports a failed age gate and a missing first step', async () => {
      repo.addMember(USER, member('draft', { dateOfBirth: '2010-01-01' }));
      repo.addMember(
        OTHER,
        member('draft', {
          completedSteps: ['step-2', 'step-3', 'step-4', 'step-5'],
          gender: null,
          dateOfBirth: null,
        }),
      );

      const young = await call('post', '/submit', USER);
      const noStepOne = await call('post', '/submit', OTHER);

      expect(young.body.details.missing).toEqual(['ageGate']);
      expect(noStepOne.body.details.missing).toEqual(['step-1']);
    });

    it('treats a missing gender or date of birth as a failed age gate', async () => {
      repo.addMember(USER, member('draft', { gender: null }));

      const res = await call('post', '/submit');

      expect(res.body.details.missing).toEqual(['ageGate']);
    });

    it('asks for a restart when the KYC case failed, even with files attached', async () => {
      repo.addMember(USER, member('draft', { kycStatus: 'failed' }));

      const res = await call('post', '/submit');

      expect(res.body.details.missing).toEqual(['kycPhoto', 'kycId']);
    });

    it('is idempotent from submitted: same submittedAt, nothing rewritten', async () => {
      repo.addMember(USER, member('draft'));
      const first = await call('post', '/submit');
      now = new Date('2026-11-15T10:00:00.000Z');

      const second = await call('post', '/submit');

      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    });

    it('answers 409 INVALID_STATUS_TRANSITION from approved', async () => {
      repo.addMember(USER, member('approved'));

      const res = await call('post', '/submit');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
      expect(repo.members.get(USER)?.profileReviewStatus).toBe('approved');
    });

    it('resubmits from needsChanges, restarts the SLA and restores review of the KYC case', async () => {
      repo.addMember(
        USER,
        member(
          'needsChanges',
          { kycStatus: 'changesNeeded' },
          new Date('2026-11-01T10:00:00.000Z'),
        ),
      );

      const res = await call('post', '/submit');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'submitted',
        submittedAt: '2026-11-14T10:00:00.000Z',
      });
      const stored = repo.members.get(USER);
      expect(stored?.facts.kycStatus).toBe('needsReview');
      expect(stored?.facts.completedSteps).toHaveLength(5);
    });

    it('refuses to resubmit a rejected profile', async () => {
      repo.addMember(USER, member('rejected'));

      const res = await call('post', '/submit');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
      expect(repo.members.get(USER)?.profileReviewStatus).toBe('rejected');
    });

    it('answers 404 for a member without an account record and 401 without a token', async () => {
      expect((await call('post', '/submit', 'ghost')).status).toBe(404);
      expect((await call('post', '/submit', null)).status).toBe(401);
    });
  });

  describe('withdraw (AC3)', () => {
    it('returns a submitted profile to draft and clears the SLA clock', async () => {
      repo.addMember(
        USER,
        member('submitted', {}, new Date('2026-11-13T10:00:00.000Z')),
      );

      const res = await call('post', '/withdraw');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'draft', submittedAt: null });
      expect(repo.members.get(USER)?.submittedAt).toBeNull();
    });

    it.each(['draft', 'approved', 'needsChanges', 'rejected'] as const)(
      'answers 409 from %s',
      async (status) => {
        repo.addMember(USER, member(status));

        const res = await call('post', '/withdraw');

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
        expect(repo.members.get(USER)?.profileReviewStatus).toBe(status);
      },
    );
  });

  describe('gating (AC6)', () => {
    it.each(PROFILE_REVIEW_STATUSES.filter((status) => status !== 'approved'))(
      'blocks matches with PROFILE_NOT_APPROVED while %s',
      async (status) => {
        repo.addMember(USER, member(status));

        const res = await call('get', '/matches').set('x-profile-status', 'approved');

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('PROFILE_NOT_APPROVED');
        expect(res.body.details).toEqual({ status });
      },
    );

    it('serves matches to an approved member', async () => {
      repo.addMember(USER, member('approved'));

      expect((await call('get', '/matches')).status).toBe(200);
    });

    it('keeps onboarding endpoints reachable in every status', async () => {
      for (const status of PROFILE_REVIEW_STATUSES) {
        repo.addMember(USER, member(status));

        expect((await call('get', '/me')).status).toBe(200);
      }
    });
  });

  describe('editing (AC7)', () => {
    it('locks every step while submitted', async () => {
      repo.addMember(USER, member('submitted'));

      for (const n of [1, 2, 3, 4, 5]) {
        const res = await call('put', `/step-${n}`, USER, {});

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('PROFILE_LOCKED_IN_REVIEW');
      }
    });

    it.each(['draft', 'needsChanges'] as const)('allows editing while %s', async (status) => {
      repo.addMember(USER, member(status));

      const res = await call('put', '/step-3', USER, { city: 'Surat' });

      expect(res.status).toBe(200);
    });

    it.each(['status', 'accountStatus', 'profileReviewStatus', 'reviewStatus'])(
      'rejects %s in a profile body with 400',
      async (key) => {
        repo.addMember(USER, member('draft'));

        const res = await call('put', '/step-3', USER, {
          city: 'Surat',
          [key]: 'approved',
        });

        expect(res.status).toBe(400);
        expect(repo.members.get(USER)?.profileReviewStatus).toBe('draft');
      },
    );
  });
});
