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
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { ApprovedProfileGuard } from '../profiles/profile-status.guards';
import { PROFILE_STATUS_READER } from '../profiles/profile-submission.repository';
import { ProfilesController } from '../profiles/profiles.controller';
import { ProfileSubmissionService } from '../profiles/profile-submission.service';
import { ProfilesService } from '../profiles/profiles.service';
import {
  DiscoveryController,
  ProfileDetailController,
} from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import {
  DISCOVERY_AGE_MINIMUMS,
  DISCOVERY_DAILY_COUNT,
  DISCOVERY_REPOSITORY,
  type DiscoveryCard,
  type DiscoveryRepository,
  type ProfileDetail,
  type SearchCriteria,
  type SearchRow,
} from './discovery.types';

const CALLER = '11111111-1111-4111-8111-111111111111';
const REF_A = 'a'.repeat(32);

function row(index: number): SearchRow {
  const ref = index.toString(16).padStart(32, '0');

  return {
    profileRef: ref,
    firstName: `Member${index}`,
    age: 28,
    city: 'Surat',
    religion: 'Hindu',
    community: 'Dhobi',
    profession: 'Engineer',
    photoRef: null,
    verified: true,
    // Larger index = older, because search lists newest first.
    createdAt: `2026-11-14T10:00:${String(60 - index).padStart(2, '0')}.000000`,
  };
}

class FakeDiscoveryRepository implements DiscoveryRepository {
  rows: SearchRow[] = [];
  views: Array<[string, string]> = [];
  lastCriteria: SearchCriteria | null = null;
  detail: ProfileDetail | null = null;

  async search(criteria: SearchCriteria): Promise<SearchRow[]> {
    this.lastCriteria = criteria;
    const ordered = [...this.rows].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
    const after = criteria.after;
    const remaining = after
      ? ordered.filter((item) => item.createdAt < after.createdAt)
      : ordered;

    return remaining.slice(0, criteria.fetch);
  }

  async dailyRecommendations(): Promise<DiscoveryCard[]> {
    return this.rows.slice(0, 9);
  }

  async findVisibleProfile(_caller: string, _ages: unknown, ref: string) {
    return this.detail && this.detail.profileRef === ref
      ? { viewedUserId: 'viewed-user-id', detail: this.detail }
      : null;
  }

  async recordView(viewerId: string, viewedId: string): Promise<void> {
    this.views.push([viewerId, viewedId]);
  }
}

class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (!req.headers['x-test-user']) {
      throw new UnauthorizedException();
    }

    req.user = { sub: CALLER, email: 'a@example.com', role: 'user' };
    return true;
  }
}

describe('Discovery (HTTP contract)', () => {
  let app: INestApplication;
  let repo: FakeDiscoveryRepository;
  let status: string;

  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('x-test-user', CALLER);

  beforeEach(async () => {
    repo = new FakeDiscoveryRepository();
    status = 'approved';

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfilesController, DiscoveryController, ProfileDetailController],
      providers: [
        DiscoveryService,
        ApprovedProfileGuard,
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: DISCOVERY_REPOSITORY, useValue: repo },
        { provide: DISCOVERY_AGE_MINIMUMS, useValue: { male: 21, female: 18 } },
        { provide: DISCOVERY_DAILY_COUNT, useValue: 9 },
        { provide: PROFILE_STATUS_READER, useValue: { findReviewStatus: async () => status } },
        {
          provide: ProfilesService,
          useValue: { getMyProfile: async () => ({ profile: null }) },
        },
        { provide: ProfileSubmissionService, useValue: {} },
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

  describe('access', () => {
    it.each(['/discovery/search', '/discovery/recommendations', `/profiles/${REF_A}`])(
      '%s answers 401 without a token',
      async (path) => {
        expect((await request(app.getHttpServer()).get(`/api/v1${path}`)).status).toBe(401);
      },
    );

    it.each(['/discovery/search', '/discovery/recommendations', `/profiles/${REF_A}`])(
      '%s answers 403 PROFILE_NOT_APPROVED when the caller is not approved',
      async (path) => {
        status = 'submitted';
        const res = await get(path);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('PROFILE_NOT_APPROVED');
      },
    );

    it('still serves the literal /profiles/me route beside /profiles/:profileRef', async () => {
      const res = await get('/profiles/me');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ profile: null });
    });
  });

  describe('search pagination', () => {
    beforeEach(() => {
      repo.rows = Array.from({ length: 25 }, (_, i) => row(i + 1));
    });

    it('defaults to 20 items and returns a cursor', async () => {
      const res = await get('/discovery/search');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(20);
      expect(typeof res.body.nextCursor).toBe('string');
    });

    it('walks two pages with no duplicate and no gap, ending with a null cursor', async () => {
      const first = await get('/discovery/search?limit=10');
      const second = await get(
        `/discovery/search?limit=15&cursor=${first.body.nextCursor}`,
      );
      const refs = [...first.body.items, ...second.body.items].map(
        (item: DiscoveryCard) => item.profileRef,
      );

      expect(refs).toHaveLength(25);
      expect(new Set(refs).size).toBe(25);
      expect(second.body.nextCursor).toBeNull();
    });

    it('keeps the next page stable when a newer profile appears between requests', async () => {
      const first = await get('/discovery/search?limit=10');

      repo.rows.push({ ...row(99), createdAt: '2026-11-14T11:00:00.000000' });

      const second = await get(
        `/discovery/search?limit=10&cursor=${first.body.nextCursor}`,
      );
      const seen = new Set(first.body.items.map((i: DiscoveryCard) => i.profileRef));

      expect(second.body.items).toHaveLength(10);
      for (const item of second.body.items) {
        expect(seen.has(item.profileRef)).toBe(false);
      }
      expect(second.body.items[0].profileRef).toBe(row(11).profileRef);
    });

    it('accepts limit=50', async () => {
      expect((await get('/discovery/search?limit=50')).status).toBe(200);
    });

    it.each(['0', '51', 'abc', '-1'])(
      'rejects limit=%s with a field-level error on limit',
      async (limit) => {
        const res = await get(`/discovery/search?limit=${limit}`);

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.details.issues)).toMatch(/limit/);
      },
    );

    it.each(['!!!', 'e30', Buffer.from('nope').toString('base64url')])(
      'rejects cursor=%s with INVALID_CURSOR',
      async (cursor) => {
        const res = await get(`/discovery/search?cursor=${cursor}`);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_CURSOR');
      },
    );
  });

  describe('search parameters', () => {
    it('passes the shipping filters to the repository, trimmed', async () => {
      const res = await get(
        '/discovery/search?maritalStatus=neverMarried&religion=%20Hindu%20&community=Dhobi&state=Gujarat&city=Surat&diet=vegetarian',
      );

      expect(res.status).toBe(200);
      expect(repo.lastCriteria?.filters).toEqual({
        maritalStatus: 'neverMarried',
        religion: 'Hindu',
        community: 'Dhobi',
        state: 'Gujarat',
        city: 'Surat',
        diet: 'vegetarian',
      });
    });

    it.each([
      'ageMin=20',
      'ageMax=40',
      'heightMin=150',
      'heightMax=190',
      'profileUid=DM123456',
      'sort=password',
      'userId=abc',
      'maritalStatus=nope',
    ])('rejects %s with 400', async (query) => {
      const res = await get(`/discovery/search?${query}`);

      expect(res.status).toBe(400);
    });

    it('treats a SQL metacharacter in a string filter as a plain value', async () => {
      const res = await get(
        `/discovery/search?city=${encodeURIComponent(`x'; DROP TABLE "Users"; --`)}`,
      );

      expect(res.status).toBe(200);
      expect(repo.lastCriteria?.filters.city).toBe(`x'; DROP TABLE "Users"; --`);
    });

    it('has no rate limit: 200 consecutive searches all answer 200', async () => {
      for (let i = 0; i < 200; i += 1) {
        expect((await get('/discovery/search')).status).toBe(200);
      }
    });
  });

  describe('result card', () => {
    it('contains exactly the allowlisted keys', async () => {
      repo.rows = [row(1)];
      const res = await get('/discovery/search');

      expect(Object.keys(res.body.items[0]).sort()).toEqual(
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
    });

    it('does not leak the cursor position inside items', async () => {
      repo.rows = [row(1)];
      const res = await get('/discovery/search');

      expect(res.body.items[0]).not.toHaveProperty('createdAt');
    });
  });

  describe('recommendations', () => {
    it('returns items, empty when there is no candidate', async () => {
      const res = await get('/discovery/recommendations');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [] });
    });
  });

  describe('profile detail', () => {
    beforeEach(() => {
      const { createdAt: _position, ...card } = row(10);

      repo.detail = {
        ...card,
        profileRef: REF_A,
        heightCm: 170,
        maritalStatus: 'neverMarried',
        diet: 'vegetarian',
        spokenLanguages: ['Gujarati'],
        subcommunity: null,
        state: 'Gujarat',
        country: 'India',
        education: 'B.E.',
        employmentType: 'private',
        familyStatus: null,
        aboutMyself: 'Hello',
        lookingFor: null,
      };
    });

    it('returns the detail and records the view once per call', async () => {
      const res = await get(`/profiles/${REF_A}`);

      expect(res.status).toBe(200);
      expect(res.body.profileRef).toBe(REF_A);
      expect(repo.views).toEqual([[CALLER, 'viewed-user-id']]);
    });

    it('carries no contact fields and no profileUid or internal id', async () => {
      const res = await get(`/profiles/${REF_A}`);

      for (const key of [
        'email',
        'mobile',
        'dateOfBirth',
        'userId',
        'profileUid',
        'viewedUserId',
        'id',
      ]) {
        expect(res.body).not.toHaveProperty(key);
      }
    });

    it('answers unknown and malformed refs with the same 404 body shape', async () => {
      const unknown = await get(`/profiles/${'b'.repeat(32)}`);
      const malformed = await get('/profiles/not-a-ref');

      for (const res of [unknown, malformed]) {
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('PROFILE_NOT_FOUND');
      }
      expect(unknown.body.message).toBe(malformed.body.message);
      expect(repo.views).toEqual([]);
    });
  });
});
