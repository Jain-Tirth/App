import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';
import { ConsentsService } from './consents.service';
import type { ConsentRepository } from './consent.repository';
import type {
  ConsentDocument,
  ConsentInput,
  ConsentRecord,
  CreateConsentRecordInput,
} from './consent.types';

const TERMS_EN = 'English terms';
const TERMS_HI = 'हिन्दी शर्तें';

function document(overrides: Partial<ConsentDocument> = {}): ConsentDocument {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'terms',
    version: '1.0',
    hash: 'a'.repeat(64),
    effectiveAt: new Date('2026-11-01T00:00:00.000Z'),
    isActive: true,
    translations: { en: TERMS_EN, hi: TERMS_HI, gu: 'ગુજરાતી શરતો' },
    ...overrides,
  };
}

function storedRecord(
  input: CreateConsentRecordInput,
  index = 0,
): ConsentRecord {
  const now = input.grantedAt;

  return {
    id: `record-${index}`,
    userId: input.userId,
    userName: input.userName,
    code: input.code,
    version: input.version,
    documentHash: input.documentHash,
    textSnapshot: input.textSnapshot,
    language: input.language,
    ip: input.ip,
    userAgent: input.userAgent,
    grantedAt: input.grantedAt,
    expiresAt: input.expiresAt,
    revokedAt: null,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  };
}

class FakeConsentRepository implements ConsentRepository {
  documents: ConsentDocument[] = [];
  records: ConsentRecord[] = [];
  inserted: CreateConsentRecordInput[] = [];
  userName: string | null = 'Asha Patel';

  async findActiveDocuments(): Promise<ConsentDocument[]> {
    return this.documents.filter((item) => item.isActive);
  }

  async findActiveDocumentByCode(
    code: string,
  ): Promise<ConsentDocument | null> {
    return (
      this.documents.find((item) => item.isActive && item.code === code) ?? null
    );
  }

  async findRecordsByUser(userId: string): Promise<ConsentRecord[]> {
    return this.records.filter((record) => record.userId === userId);
  }

  async findLatestRecordByCode(
    userId: string,
    code: string,
  ): Promise<ConsentRecord | null> {
    return (
      this.records.find(
        (record) => record.userId === userId && record.code === code,
      ) ?? null
    );
  }

  async findUserName(): Promise<string | null> {
    return this.userName;
  }

  async insertRecord(
    input: CreateConsentRecordInput,
  ): Promise<ConsentRecord> {
    this.inserted.push(input);
    const record = storedRecord(input, this.records.length);
    this.records.push(record);
    return record;
  }

  async insertRecords(
    inputs: CreateConsentRecordInput[],
  ): Promise<ConsentRecord[]> {
    return Promise.all(inputs.map((input) => this.insertRecord(input)));
  }
}

const validInput: ConsentInput = {
  code: 'terms',
  version: '1.0',
  documentHash: 'a'.repeat(64),
};

describe('ConsentsService', () => {
  let repository: FakeConsentRepository;
  let service: ConsentsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T10:00:00.000Z'));
    repository = new FakeConsentRepository();
    repository.documents = [document()];
    service = new ConsentsService(repository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores the exact requested-language text and a 24-month expiry', async () => {
    const record = await service.recordConsent(
      'user-1',
      validInput,
      {
        ip: '203.0.113.5',
        userAgent: 'jest-agent',
        language: 'hi',
        source: 'api',
      },
    );

    expect(record).toMatchObject({
      userId: 'user-1',
      userName: 'Asha Patel',
      code: 'terms',
      version: '1.0',
      documentHash: 'a'.repeat(64),
      textSnapshot: TERMS_HI,
      language: 'hi',
      ip: '203.0.113.5',
      userAgent: 'jest-agent',
      source: 'api',
    });
    expect(record.grantedAt.toISOString()).toBe('2026-11-10T10:00:00.000Z');
    expect(record.expiresAt.toISOString()).toBe('2028-11-10T10:00:00.000Z');
  });

  it('rejects a stale version without writing a record', async () => {
    await expect(
      service.recordConsent(
        'user-1',
        { ...validInput, version: '0.9' },
        { ip: '', userAgent: '', source: 'api' },
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      code: 'CONSENT_DOCUMENT_MISMATCH',
    });

    expect(repository.inserted).toHaveLength(0);
  });

  it('rejects an unknown consent code without writing a record', async () => {
    await expect(
      service.recordConsent(
        'user-1',
        { ...validInput, code: 'marketing' },
        { ip: '', userAgent: '', source: 'api' },
      ),
    ).rejects.toBeInstanceOf(ApiException);

    expect(repository.inserted).toHaveLength(0);
  });

  it('lists every missing required code at registration', async () => {
    repository.documents = [
      document(),
      document({ id: 'privacy', code: 'privacy' }),
      document({ id: 'id_processing', code: 'id_processing' }),
    ];

    await expect(service.validateRegistrationConsents([])).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      code: 'CONSENT_REQUIRED',
      details: {
        missingConsents: ['terms', 'privacy', 'id_processing'],
      },
    });
  });

  it('accepts registration consents that match the active documents', async () => {
    repository.documents = [
      document(),
      document({ id: 'privacy', code: 'privacy' }),
      document({ id: 'id_processing', code: 'id_processing' }),
    ];

    const accepted = await service.validateRegistrationConsents([
      validInput,
      { ...validInput, code: 'privacy' },
      { ...validInput, code: 'id_processing' },
    ]);

    expect(accepted.map((item) => item.document.code)).toEqual([
      'terms',
      'privacy',
      'id_processing',
    ]);
  });

  it('writes one record per accepted registration consent', async () => {
    repository.documents = [
      document(),
      document({ id: 'privacy', code: 'privacy' }),
      document({ id: 'id_processing', code: 'id_processing' }),
    ];
    const accepted = await service.validateRegistrationConsents([
      validInput,
      { ...validInput, code: 'privacy' },
      { ...validInput, code: 'id_processing' },
    ]);

    const records = await service.recordRegistrationConsents(
      { id: 'user-1', name: 'Asha Patel' },
      accepted,
      { ip: '203.0.113.5', userAgent: 'jest-agent', language: 'en' },
    );

    expect(records.map((record) => record.code)).toEqual([
      'terms',
      'privacy',
      'id_processing',
    ]);
    expect(records.every((record) => record.source === 'registration')).toBe(
      true,
    );
  });

  it('reports an expired record on the current endpoint', async () => {
    repository.records = [
      storedRecord({
        userId: 'user-1',
        userName: 'Asha Patel',
        code: 'terms',
        version: '1.0',
        documentHash: 'a'.repeat(64),
        textSnapshot: TERMS_EN,
        language: 'en',
        ip: '',
        userAgent: '',
        grantedAt: new Date('2024-10-01T00:00:00.000Z'),
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        source: 'api',
      }),
    ];

    const result = await service.getCurrentConsents('user-1', 'en');

    expect(result.consents).toHaveLength(1);
    expect(result.consents[0]).toMatchObject({
      code: 'terms',
      accepted: true,
      expired: true,
      requiresReconsent: true,
    });
  });
});
