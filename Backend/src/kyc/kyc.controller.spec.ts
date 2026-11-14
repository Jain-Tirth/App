import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { FakeStorageProvider } from '../storage/fake-storage.provider';
import { OBJECT_STORAGE } from '../storage/object-storage';
import { AesGcmIdNumberCipher, ID_NUMBER_CIPHER } from './id-number.cipher';
import { InMemoryKycRepository } from './in-memory-kyc.repository';
import { KycController } from './kyc.controller';
import { KYC_PROVIDER, ManualKycProvider } from './kyc.provider';
import { KYC_REPOSITORY } from './kyc.repository';
import {
  KYC_CLOCK,
  KYC_CONSENT_GATE,
  KycService,
} from './kyc.service';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const FULL_ID = '123456789012';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('body')]);
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

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

describe('KycController (HTTP contract)', () => {
  let app: INestApplication;
  let storage: FakeStorageProvider;
  let repo: InMemoryKycRepository;
  let consentValid: boolean;
  let now: Date;
  let bodiesSent: string[];
  let bodiesReceived: string[];

  beforeEach(async () => {
    consentValid = true;
    now = new Date('2026-11-14T10:00:00.000Z');
    bodiesSent = [];
    bodiesReceived = [];
    storage = new FakeStorageProvider(() => now);
    repo = new InMemoryKycRepository(() => now);

    const moduleRef = await Test.createTestingModule({
      controllers: [KycController],
      providers: [
        KycService,
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: KYC_REPOSITORY, useValue: repo },
        { provide: OBJECT_STORAGE, useValue: storage },
        { provide: KYC_PROVIDER, useValue: new ManualKycProvider() },
        {
          provide: ID_NUMBER_CIPHER,
          useValue: new AesGcmIdNumberCipher(Buffer.alloc(32, 3)),
        },
        {
          provide: KYC_CONSENT_GATE,
          useValue: { hasValidRequiredConsents: async () => consentValid },
        },
        { provide: KYC_CLOCK, useValue: () => now },
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

  async function call(
    method: 'get' | 'post' | 'delete',
    path: string,
    user: string | null,
    body?: object,
  ) {
    let req = request(app.getHttpServer())[method](`/api/v1/kyc/verification${path}`);

    if (user) {
      req = req.set('x-test-user', user);
    }

    if (body) {
      bodiesSent.push(JSON.stringify(body));
      req = req.send(body);
    }

    const response = await req;
    bodiesReceived.push(JSON.stringify(response.body));
    return response;
  }

  async function uploadAndComplete(
    user: string,
    purpose: 'kycPhoto' | 'kycId',
    bytes: Buffer,
  ) {
    const ticket = await call('post', '/uploads', user, {
      purpose,
      contentType: 'image/jpeg',
      sizeBytes: bytes.length,
      fileName: 'f.jpg',
      ...(purpose === 'kycId'
        ? { documentType: 'aadhaar', idNumber: FULL_ID }
        : {}),
    });
    expect(ticket.status).toBe(201);
    expect(storage.putViaUrl(ticket.body.uploadUrl, bytes)).toBe(200);
    return call('post', `/uploads/${ticket.body.mediaId}/complete`, user, {
      checksum: sha(bytes),
    });
  }

  it('answers 401 with no token on every route', async () => {
    const id = '33333333-3333-4333-8333-333333333333';

    expect((await call('post', '', null)).status).toBe(401);
    expect((await call('get', '', null)).status).toBe(401);
    expect((await call('post', '/uploads', null, {})).status).toBe(401);
    expect((await call('post', `/uploads/${id}/complete`, null, {})).status).toBe(401);
    expect((await call('get', `/media/${id}/url`, null)).status).toBe(401);
    expect((await call('delete', `/uploads/${id}`, null)).status).toBe(401);
    expect((await call('post', '/restart', null)).status).toBe(401);
  });

  it('creates a case (201) and refuses 403 CONSENT_REQUIRED without consent', async () => {
    consentValid = false;
    const refused = await call('post', '', USER_A);

    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('CONSENT_REQUIRED');
    expect(repo.cases).toHaveLength(0);

    consentValid = true;
    const created = await call('post', '', USER_A);

    expect(created.status).toBe(201);
    expect(created.body.status).toBe('consentGiven');
  });

  it('rejects client-supplied status and userId with 400', async () => {
    const response = await call('post', '', USER_A, {
      status: 'needsReview',
      userId: USER_B,
    });

    expect(response.status).toBe(400);
    expect(repo.cases).toHaveLength(0);
  });

  it('returns a field-level error for an unlisted documentType and stores nothing', async () => {
    await call('post', '', USER_A);

    const response = await call('post', '/uploads', USER_A, {
      purpose: 'kycId',
      contentType: 'image/jpeg',
      sizeBytes: 10,
      fileName: 'id.jpg',
      documentType: 'passport',
      idNumber: FULL_ID,
    });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.details)).toContain('documentType');
    expect(repo.media).toHaveLength(0);
    expect(repo.cases[0].documentType).toBeNull();
  });

  it('completes the two-file flow to needsReview', async () => {
    await call('post', '', USER_A);

    const photo = await uploadAndComplete(USER_A, 'kycPhoto', jpeg);
    expect(photo.status).toBe(200);
    expect(photo.body.status).toBe('documentUploaded');

    const id = await uploadAndComplete(USER_A, 'kycId', jpeg);
    expect(id.status).toBe(200);
    expect(id.body.status).toBe('needsReview');
    expect(id.body.documentType).toBe('aadhaar');
    expect(id.body.idNumberLast4).toBe('9012');
  });

  it('never returns the full ID number or a storage key, and sends no file bytes', async () => {
    await call('post', '', USER_A);
    await uploadAndComplete(USER_A, 'kycPhoto', jpeg);
    await uploadAndComplete(USER_A, 'kycId', jpeg);
    const mediaId = repo.media[0].id;
    await call('get', '', USER_A);
    await call('get', `/media/${mediaId}/url`, USER_A);

    for (const body of bodiesReceived) {
      expect(body).not.toContain(FULL_ID);
      expect(body).not.toContain(`kyc/${USER_A}`);
    }

    for (const body of bodiesSent) {
      expect(body).not.toContain('body');
      expect(body.length).toBeLessThan(300);
    }
  });

  it('marks responses private, no-store', async () => {
    const response = await call('post', '', USER_A);

    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('serves a read URL that dies after 10 minutes', async () => {
    await call('post', '', USER_A);
    await uploadAndComplete(USER_A, 'kycPhoto', jpeg);

    const response = await call('get', `/media/${repo.media[0].id}/url`, USER_A);

    expect(response.status).toBe(200);
    expect(storage.getViaUrl(response.body.url).status).toBe(200);
    now = new Date('2026-11-14T10:10:01.000Z');
    expect(storage.getViaUrl(response.body.url).status).toBe(403);
  });

  it('answers 404 when another member uses the media id', async () => {
    await call('post', '', USER_A);
    await uploadAndComplete(USER_A, 'kycPhoto', jpeg);
    const mediaId = repo.media[0].id;

    expect((await call('get', `/media/${mediaId}/url`, USER_B)).status).toBe(404);
    expect(
      (await call('post', `/uploads/${mediaId}/complete`, USER_B, { checksum: sha(jpeg) }))
        .status,
    ).toBe(404);
    expect((await call('delete', `/uploads/${mediaId}`, USER_B)).status).toBe(404);
  });

  it('rejects a malformed media id with 400', async () => {
    expect((await call('get', '/media/not-a-uuid/url', USER_A)).status).toBe(400);
  });

  it('rejects a bad checksum shape with 400', async () => {
    const id = '33333333-3333-4333-8333-333333333333';

    const response = await call('post', `/uploads/${id}/complete`, USER_A, {
      checksum: 'abc',
    });

    expect(response.status).toBe(400);
  });

  it('discards an abandoned upload with 204', async () => {
    await call('post', '', USER_A);
    const ticket = await call('post', '/uploads', USER_A, {
      purpose: 'kycPhoto',
      contentType: 'image/jpeg',
      sizeBytes: 5,
      fileName: 'a.jpg',
    });

    const response = await call('delete', `/uploads/${ticket.body.mediaId}`, USER_A);

    expect(response.status).toBe(204);
  });

  it('restarts a failed case and answers 429 with Retry-After on the 4th', async () => {
    await call('post', '', USER_A);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      repo.cases[0].status = 'failed';
      expect((await call('post', '/restart', USER_A)).status).toBe(200);
    }

    repo.cases[0].status = 'changesNeeded';
    const blocked = await call('post', '/restart', USER_A);

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RESTART_LIMIT_REACHED');
    expect(blocked.headers['retry-after']).toBe('86400');
  });

  it('rejects any body on restart', async () => {
    await call('post', '', USER_A);
    repo.cases[0].status = 'failed';

    const response = await call('post', '/restart', USER_A, { status: 'consentGiven' });

    expect(response.status).toBe(400);
  });
});
