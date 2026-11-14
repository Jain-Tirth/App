import { ConsentsService } from './consents.service';
import type { ConsentRepository } from './consent.repository';
import type { ConsentDocument, ConsentRecord } from './consent.types';

const HASH = 'a'.repeat(64);
const NOW = Date.now();

function document(code: string): ConsentDocument {
  return {
    id: `doc-${code}`,
    code,
    version: '1.0',
    hash: HASH,
    effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
    isActive: true,
    translations: { en: `${code} text` },
  };
}

function record(code: string, overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: `rec-${code}`,
    userId: 'u1',
    userName: 'Asha',
    code,
    version: '1.0',
    documentHash: HASH,
    textSnapshot: 'text',
    language: 'en',
    ip: '127.0.0.1',
    userAgent: 'jest',
    grantedAt: new Date(NOW - 86_400_000),
    expiresAt: new Date(NOW + 86_400_000 * 365),
    revokedAt: null,
    source: 'registration',
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...overrides,
  };
}

function serviceWith(records: Record<string, ConsentRecord | null>): ConsentsService {
  const documents = ['terms', 'privacy', 'id_processing'].map(document);
  const repository = {
    findActiveDocuments: async () => documents,
    findLatestRecordByCode: async (_userId: string, code: string) =>
      records[code] ?? null,
  } as unknown as ConsentRepository; // only the two methods under test are used

  return new ConsentsService(repository);
}

describe('ConsentsService.hasValidRequiredConsents', () => {
  const all = {
    terms: record('terms'),
    privacy: record('privacy'),
    id_processing: record('id_processing'),
  };

  it('is true when every required consent is current and unexpired', async () => {
    expect(await serviceWith(all).hasValidRequiredConsents('u1')).toBe(true);
  });

  it('is false when a required consent was never given', async () => {
    expect(
      await serviceWith({ ...all, id_processing: null }).hasValidRequiredConsents('u1'),
    ).toBe(false);
  });

  it('is false when a required consent has expired', async () => {
    const expired = record('privacy', { expiresAt: new Date(NOW - 1000) });

    expect(
      await serviceWith({ ...all, privacy: expired }).hasValidRequiredConsents('u1'),
    ).toBe(false);
  });

  it('is false when a consent is for an outdated document version', async () => {
    const stale = record('terms', { version: '0.9' });

    expect(
      await serviceWith({ ...all, terms: stale }).hasValidRequiredConsents('u1'),
    ).toBe(false);
  });
});
