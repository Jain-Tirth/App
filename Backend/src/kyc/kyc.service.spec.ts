import { createHash } from 'node:crypto';
import { ApiException } from '../common/api-error';
import { FakeStorageProvider } from '../storage/fake-storage.provider';
import { AesGcmIdNumberCipher } from './id-number.cipher';
import { InMemoryKycRepository } from './in-memory-kyc.repository';
import { KycService } from './kyc.service';
import { FakeKycProvider } from './kyc.provider';
import type { KycPurpose } from './kyc.types';

const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('jpeg-body'),
]);
const pdf = Buffer.from('%PDF-1.7 body');
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const FULL_ID = '1234 5678 9012';

interface Harness {
  service: KycService;
  repo: InMemoryKycRepository;
  storage: FakeStorageProvider;
  provider: FakeKycProvider;
  cipher: AesGcmIdNumberCipher;
  setNow(next: Date): void;
  setConsentValid(valid: boolean): void;
  upload(
    userId: string,
    purpose: KycPurpose,
    bytes: Buffer,
    overrides?: { contentType?: string; sizeBytes?: number },
  ): Promise<string>;
  attach(userId: string, purpose: KycPurpose, bytes: Buffer): Promise<void>;
}

function harness(): Harness {
  let now = new Date('2026-11-14T10:00:00.000Z');
  let consentValid = true;
  const clock = () => now;
  const repo = new InMemoryKycRepository(clock);
  const storage = new FakeStorageProvider(clock);
  const provider = new FakeKycProvider();
  const cipher = new AesGcmIdNumberCipher(Buffer.alloc(32, 5));
  const service = new KycService(
    repo,
    storage,
    provider,
    cipher,
    { hasValidRequiredConsents: async () => consentValid },
    clock,
  );

  const upload = async (
    userId: string,
    purpose: KycPurpose,
    bytes: Buffer,
    overrides: { contentType?: string; sizeBytes?: number } = {},
  ) => {
    const ticket = await service.requestUpload(userId, {
      purpose,
      contentType:
        overrides.contentType ?? (bytes === pdf ? 'application/pdf' : 'image/jpeg'),
      sizeBytes: overrides.sizeBytes ?? bytes.length,
      fileName: 'file.bin',
      ...(purpose === 'kycId'
        ? { documentType: 'aadhaar' as const, idNumber: FULL_ID }
        : {}),
    });
    storage.putViaUrl(ticket.uploadUrl, bytes);
    return ticket.mediaId;
  };

  return {
    service,
    repo,
    storage,
    provider,
    cipher,
    setNow: (next) => {
      now = next;
    },
    setConsentValid: (valid) => {
      consentValid = valid;
    },
    upload,
    attach: async (userId, purpose, bytes) => {
      const mediaId = await upload(userId, purpose, bytes);
      await service.completeUpload(userId, mediaId, sha(bytes));
    },
  };
}

async function errorOf(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiException) {
      return error;
    }
    throw error;
  }
  throw new Error('expected the call to fail');
}

describe('KycService', () => {
  describe('createVerification (AC1)', () => {
    it('creates a consentGiven case when consent is valid', async () => {
      const h = harness();

      const view = await h.service.createVerification('u1', 'en');

      expect(view.status).toBe('consentGiven');
      expect(view.media).toEqual([]);
      expect(h.provider.calls).toEqual(['createSession:u1']);
    });

    it('refuses with 403 and creates nothing without valid consent', async () => {
      const h = harness();
      h.setConsentValid(false);

      const error = await errorOf(h.service.createVerification('u1', 'en'));

      expect(error.status).toBe(403);
      expect(error.code).toBe('CONSENT_REQUIRED');
      expect(h.repo.cases).toHaveLength(0);
    });

    it('answers 409 when a case already exists', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');

      const error = await errorOf(h.service.createVerification('u1', 'en'));

      expect(error.status).toBe(409);
      expect(error.code).toBe('VERIFICATION_ALREADY_EXISTS');
    });
  });

  describe('uploads (AC2, AC3)', () => {
    it('moves to documentUploaded with one file and needsReview with both', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');

      await h.attach('u1', 'kycPhoto', jpeg);
      expect((await h.service.getVerification('u1')).status).toBe('documentUploaded');

      await h.attach('u1', 'kycId', pdf);
      const view = await h.service.getVerification('u1');

      expect(view.status).toBe('needsReview');
      expect(view.documentType).toBe('aadhaar');
      expect(view.media.map((item) => item.purpose).sort()).toEqual([
        'kycId',
        'kycPhoto',
      ]);
    });

    it('leaves the status at documentUploaded when only the ID is present', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');

      await h.attach('u1', 'kycId', jpeg);

      expect((await h.service.getVerification('u1')).status).toBe('documentUploaded');
    });

    it('returns a URL expiring in 10 minutes and a media id', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');

      const ticket = await h.service.requestUpload('u1', {
        purpose: 'kycPhoto',
        contentType: 'image/jpeg',
        sizeBytes: 10,
        fileName: 'me.jpg',
      });

      expect(ticket.mediaId).toMatch(/^[0-9a-f-]{36}$/);
      expect(ticket.method).toBe('PUT');
      expect(ticket.headers).toEqual({ 'Content-Type': 'image/jpeg' });
      expect(ticket.expiresAt.getTime()).toBe(
        new Date('2026-11-14T10:10:00.000Z').getTime(),
      );
    });

    it('rejects an upload request when there is no case', async () => {
      const h = harness();

      const error = await errorOf(
        h.service.requestUpload('u1', {
          purpose: 'kycPhoto',
          contentType: 'image/jpeg',
          sizeBytes: 10,
          fileName: 'me.jpg',
        }),
      );

      expect(error.status).toBe(404);
      expect(error.code).toBe('VERIFICATION_NOT_FOUND');
    });

    it('rejects an upload request once the case is in review', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      await h.attach('u1', 'kycPhoto', jpeg);
      await h.attach('u1', 'kycId', jpeg);

      const error = await errorOf(
        h.service.requestUpload('u1', {
          purpose: 'kycPhoto',
          contentType: 'image/jpeg',
          sizeBytes: 10,
          fileName: 'me.jpg',
        }),
      );

      expect(error.status).toBe(409);
      expect(error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('replaces the earlier file of the same purpose', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      await h.attach('u1', 'kycPhoto', jpeg);
      const firstKey = h.repo.media[0].storageKey;

      await h.attach('u1', 'kycPhoto', Buffer.concat([jpeg, Buffer.from('2')]));

      expect(await h.storage.inspect(firstKey, 100)).toBeNull();
      expect((await h.service.getVerification('u1')).media).toHaveLength(1);
    });

    it('stores nothing for a rejected request (oversize declaration)', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');

      const error = await errorOf(
        h.service.requestUpload('u1', {
          purpose: 'kycPhoto',
          contentType: 'image/jpeg',
          sizeBytes: 10 * 1024 * 1024 + 1,
          fileName: 'big.jpg',
        }),
      );

      expect(error.code).toBe('FILE_TOO_LARGE');
      expect(h.repo.media).toHaveLength(0);
    });

    it('accepts exactly 10 MB of a valid file', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const big = Buffer.concat([jpeg, Buffer.alloc(10 * 1024 * 1024 - jpeg.length)]);

      await h.attach('u1', 'kycPhoto', big);

      expect((await h.service.getVerification('u1')).status).toBe('documentUploaded');
    });

    it('answers UPLOAD_NOT_FOUND for an object never uploaded', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const ticket = await h.service.requestUpload('u1', {
        purpose: 'kycPhoto',
        contentType: 'image/jpeg',
        sizeBytes: 5,
        fileName: 'a.jpg',
      });

      const error = await errorOf(
        h.service.completeUpload('u1', ticket.mediaId, sha(jpeg)),
      );

      expect(error.status).toBe(400);
      expect(error.code).toBe('UPLOAD_NOT_FOUND');
      expect((await h.service.getVerification('u1')).media).toEqual([]);
    });

    it('answers SIZE_MISMATCH and attaches nothing', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', jpeg, {
        sizeBytes: jpeg.length + 1,
      });

      const error = await errorOf(h.service.completeUpload('u1', mediaId, sha(jpeg)));

      expect(error.code).toBe('SIZE_MISMATCH');
      expect((await h.service.getVerification('u1')).status).toBe('consentGiven');
      expect((await h.service.getVerification('u1')).media).toEqual([]);
    });

    it('answers CHECKSUM_MISMATCH and attaches nothing', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', jpeg);

      const error = await errorOf(
        h.service.completeUpload('u1', mediaId, sha(Buffer.from('other'))),
      );

      expect(error.code).toBe('CHECKSUM_MISMATCH');
      expect((await h.service.getVerification('u1')).media).toEqual([]);
    });

    it('answers FILE_CONTENT_MISMATCH for text renamed to .jpg', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const text = Buffer.from('plain text pretending to be a photo');
      const mediaId = await h.upload('u1', 'kycPhoto', text, {
        contentType: 'image/jpeg',
      });

      const error = await errorOf(h.service.completeUpload('u1', mediaId, sha(text)));

      expect(error.code).toBe('FILE_CONTENT_MISMATCH');
      expect((await h.service.getVerification('u1')).status).toBe('consentGiven');
    });

    it('rejects a PDF sent as the member photo with a purpose error', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', pdf, {
        contentType: 'image/jpeg',
      });

      const error = await errorOf(h.service.completeUpload('u1', mediaId, sha(pdf)));

      expect(error.code).toBe('FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE');
    });

    it('rejects a PDF declared for the member photo before issuing a URL', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');

      const error = await errorOf(
        h.service.requestUpload('u1', {
          purpose: 'kycPhoto',
          contentType: 'application/pdf',
          sizeBytes: 5,
          fileName: 'a.pdf',
        }),
      );

      expect(error.code).toBe('FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE');
      expect(h.repo.media).toHaveLength(0);
    });

    it('treats completing an attached upload again as a no-op', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', jpeg);
      await h.service.completeUpload('u1', mediaId, sha(jpeg));

      const view = await h.service.completeUpload('u1', mediaId, sha(jpeg));

      expect(view.media).toHaveLength(1);
    });
  });

  describe('ID number (AC4)', () => {
    it('stores it encrypted and exposes only the last 4 characters', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      await h.attach('u1', 'kycId', jpeg);

      const stored = h.repo.cases[0];
      const view = await h.service.getVerification('u1');

      expect(stored.idNumberEncrypted).not.toContain('9012');
      expect(h.cipher.decrypt(stored.idNumberEncrypted ?? '')).toBe('123456789012');
      expect(view.idNumberLast4).toBe('9012');
      expect(JSON.stringify(view)).not.toContain('123456789012');
      expect(JSON.stringify(view)).not.toContain('kyc/');
    });
  });

  describe('media access (AC5, AC6)', () => {
    it('issues a signed read URL that expires in 10 minutes', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', jpeg);
      await h.service.completeUpload('u1', mediaId, sha(jpeg));

      const read = await h.service.getMediaReadUrl('u1', mediaId);

      expect(h.storage.getViaUrl(read.url).status).toBe(200);
      expect(read.expiresAt.getTime()).toBe(
        new Date('2026-11-14T10:10:00.000Z').getTime(),
      );
      h.setNow(new Date('2026-11-14T10:10:01.000Z'));
      expect(h.storage.getViaUrl(read.url).status).toBe(403);
    });

    it('answers 404 to another member for read, complete and discard', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', jpeg);

      for (const call of [
        h.service.getMediaReadUrl('u2', mediaId),
        h.service.completeUpload('u2', mediaId, sha(jpeg)),
        h.service.discardPendingUpload('u2', mediaId),
      ]) {
        const error = await errorOf(call);
        expect(error.status).toBe(404);
        expect(error.code).toBe('MEDIA_NOT_FOUND');
      }
    });

    it('answers 404 for a read URL of an upload that is not attached', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', jpeg);

      const error = await errorOf(h.service.getMediaReadUrl('u1', mediaId));

      expect(error.code).toBe('MEDIA_NOT_FOUND');
    });

    it('discards an abandoned upload and its object', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', jpeg);
      const key = h.repo.media[0].storageKey;

      await h.service.discardPendingUpload('u1', mediaId);

      expect(h.repo.media).toHaveLength(0);
      expect(await h.storage.inspect(key, 100)).toBeNull();
    });

    it('refuses to discard an attached file', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      const mediaId = await h.upload('u1', 'kycPhoto', jpeg);
      await h.service.completeUpload('u1', mediaId, sha(jpeg));

      const error = await errorOf(h.service.discardPendingUpload('u1', mediaId));

      expect(error.status).toBe(409);
      expect(error.code).toBe('MEDIA_ALREADY_ATTACHED');
    });
  });

  describe('restart (AC7)', () => {
    async function failedCase(h: Harness): Promise<void> {
      await h.service.createVerification('u1', 'en');
      h.repo.cases[0].status = 'failed';
    }

    it('resets a failed case and clears its files and ID details', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');
      await h.attach('u1', 'kycId', jpeg);
      const key = h.repo.media[0].storageKey;
      h.repo.cases[0].status = 'changesNeeded';

      const view = await h.service.restart('u1');

      expect(view.status).toBe('consentGiven');
      expect(view.media).toEqual([]);
      expect(view.documentType).toBeNull();
      expect(view.idNumberLast4).toBeNull();
      expect(await h.storage.inspect(key, 100)).toBeNull();
    });

    it('refuses to restart a case that is not failed or changesNeeded', async () => {
      const h = harness();
      await h.service.createVerification('u1', 'en');

      const error = await errorOf(h.service.restart('u1'));

      expect(error.status).toBe(409);
      expect(error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('answers 404 when there is no case', async () => {
      const h = harness();

      const error = await errorOf(h.service.restart('u1'));

      expect(error.code).toBe('VERIFICATION_NOT_FOUND');
    });

    it('requires valid consent', async () => {
      const h = harness();
      await failedCase(h);
      h.setConsentValid(false);

      const error = await errorOf(h.service.restart('u1'));

      expect(error.status).toBe(403);
    });

    it('allows 3 restarts in 24 hours and blocks the 4th with Retry-After', async () => {
      const h = harness();
      await failedCase(h);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await h.service.restart('u1');
        h.repo.cases[0].status = 'failed';
        h.setNow(new Date(Date.parse('2026-11-14T10:00:00.000Z') + (attempt + 1) * 3600_000));
      }

      const error = await errorOf(h.service.restart('u1'));

      expect(error.status).toBe(429);
      expect(error.code).toBe('RESTART_LIMIT_REACHED');
      expect(error.headers['Retry-After']).toBe(String(21 * 3600));
    });

    it('allows the 4th restart once the oldest is 24 hours old', async () => {
      const h = harness();
      await failedCase(h);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await h.service.restart('u1');
        h.repo.cases[0].status = 'failed';
      }

      h.setNow(new Date('2026-11-15T10:00:00.000Z'));
      const view = await h.service.restart('u1');

      expect(view.status).toBe('consentGiven');
    });
  });
});
