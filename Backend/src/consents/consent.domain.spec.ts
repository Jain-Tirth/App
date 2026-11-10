import {
  addMonths,
  calculateExpiresAt,
  evaluateRequiredConsents,
  getConsentText,
  isExpired,
  matchesActiveDocument,
  resolveConsentLanguage,
  summarizeConsent,
} from './consent.domain';
import type {
  ConsentDocument,
  ConsentInput,
  ConsentRecord,
} from './consent.types';

const TERMS_TEXT_EN = 'English terms text';
const TERMS_TEXT_HI = 'हिन्दी शर्तें';

function document(overrides: Partial<ConsentDocument> = {}): ConsentDocument {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'terms',
    version: '1.0',
    hash: 'a'.repeat(64),
    effectiveAt: new Date('2026-11-01T00:00:00.000Z'),
    isActive: true,
    translations: { en: TERMS_TEXT_EN, hi: TERMS_TEXT_HI, gu: 'ગુજરાતી શરતો' },
    ...overrides,
  };
}

function record(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    userId: '33333333-3333-3333-3333-333333333333',
    userName: 'Asha Patel',
    code: 'terms',
    version: '1.0',
    documentHash: 'a'.repeat(64),
    textSnapshot: TERMS_TEXT_EN,
    language: 'en',
    ip: '127.0.0.1',
    userAgent: 'jest',
    grantedAt: new Date('2026-11-10T10:00:00.000Z'),
    expiresAt: new Date('2028-11-10T10:00:00.000Z'),
    revokedAt: null,
    source: 'api',
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    ...overrides,
  };
}

const input = (overrides: Partial<ConsentInput> = {}): ConsentInput => ({
  code: 'terms',
  version: '1.0',
  documentHash: 'a'.repeat(64),
  ...overrides,
});

describe('consent domain', () => {
  describe('expiry', () => {
    it('sets expiry exactly 24 calendar months after grant', () => {
      const grantedAt = new Date('2026-01-15T12:30:00.000Z');

      expect(calculateExpiresAt(grantedAt).toISOString()).toBe(
        '2028-01-15T12:30:00.000Z',
      );
    });

    it('clamps a month-end grant to the last day of the target month', () => {
      expect(addMonths(new Date('2026-01-31T00:00:00.000Z'), 24).toISOString()).toBe(
        '2028-01-31T00:00:00.000Z',
      );
      expect(addMonths(new Date('2024-02-29T00:00:00.000Z'), 12).toISOString()).toBe(
        '2025-02-28T00:00:00.000Z',
      );
    });

    it('treats a record as expired at and after its expiry instant', () => {
      expect(
        isExpired(
          '2026-11-10T10:00:00.000Z',
          new Date('2026-11-10T10:00:00.000Z'),
        ),
      ).toBe(true);
      expect(
        isExpired(
          '2026-11-10T10:00:00.000Z',
          new Date('2026-11-10T09:59:59.999Z'),
        ),
      ).toBe(false);
    });
  });

  describe('language selection', () => {
    it('returns the requested language when a translation exists', () => {
      expect(resolveConsentLanguage('hi', document().translations)).toBe('hi');
      expect(getConsentText(document(), 'hi')).toEqual({
        language: 'hi',
        text: TERMS_TEXT_HI,
      });
    });

    it('falls back to en when the translation is missing', () => {
      const englishOnly = document({ translations: { en: TERMS_TEXT_EN } });

      expect(resolveConsentLanguage('gu', englishOnly.translations)).toBe('en');
      expect(getConsentText(englishOnly, 'gu')).toEqual({
        language: 'en',
        text: TERMS_TEXT_EN,
      });
    });

    it('falls back to en for an unsupported language', () => {
      expect(resolveConsentLanguage('fr', document().translations)).toBe('en');
    });
  });

  describe('document matching', () => {
    it('accepts the active code, version and hash', () => {
      expect(matchesActiveDocument(input(), document())).toBe(true);
    });

    it('rejects a stale version', () => {
      expect(matchesActiveDocument(input({ version: '0.9' }), document())).toBe(
        false,
      );
    });

    it('rejects a stale document hash', () => {
      expect(
        matchesActiveDocument(input({ documentHash: 'b'.repeat(64) }), document()),
      ).toBe(false);
    });
  });

  describe('required consent enforcement', () => {
    const terms = document();
    const privacy = document({
      id: '44444444-4444-4444-4444-444444444444',
      code: 'privacy',
    });
    const idProcessing = document({
      id: '55555555-5555-5555-5555-555555555555',
      code: 'id_processing',
    });
    const activeDocuments = [terms, privacy, idProcessing];

    it('lists every required code when nothing is submitted', () => {
      expect(evaluateRequiredConsents([], activeDocuments).missingCodes).toEqual([
        'terms',
        'privacy',
        'id_processing',
      ]);
    });

    it('lists a stale required code as missing', () => {
      const result = evaluateRequiredConsents(
        [
          input({ version: '0.9' }),
          input({ code: 'privacy' }),
          input({ code: 'id_processing' }),
        ],
        activeDocuments,
      );

      expect(result.missingCodes).toEqual(['terms']);
      expect(result.invalidCodes).toEqual(['terms']);
    });

    it('accepts all required codes when they match the active documents', () => {
      const result = evaluateRequiredConsents(
        [
          input({ code: 'terms' }),
          input({ code: 'privacy' }),
          input({ code: 'id_processing' }),
        ],
        activeDocuments,
      );

      expect(result.missingCodes).toEqual([]);
      expect(result.invalidCodes).toEqual([]);
      expect(result.accepted.map((item) => item.document.code)).toEqual([
        'terms',
        'privacy',
        'id_processing',
      ]);
    });
  });

  describe('current consent summary', () => {
    const now = new Date('2026-11-10T12:00:00.000Z');

    it('reports an expired record as expired and requiring re-consent', () => {
      const summary = summarizeConsent(
        document(),
        record({ expiresAt: new Date('2026-11-09T12:00:00.000Z') }),
        'en',
        now,
      );

      expect(summary.expired).toBe(true);
      expect(summary.accepted).toBe(true);
      expect(summary.requiresReconsent).toBe(true);
    });

    it('does not mark a current record as expired', () => {
      const summary = summarizeConsent(document(), record(), 'en', now);

      expect(summary.expired).toBe(false);
      expect(summary.requiresReconsent).toBe(false);
      expect(summary.text).toBe(TERMS_TEXT_EN);
    });

    it('requires re-consent when the member accepted an older version', () => {
      const summary = summarizeConsent(
        document({ version: '2.0', hash: 'c'.repeat(64) }),
        record(),
        'en',
        now,
      );

      expect(summary.expired).toBe(false);
      expect(summary.requiresReconsent).toBe(true);
    });

    it('requires re-consent when no record exists', () => {
      const summary = summarizeConsent(document(), null, 'hi', now);

      expect(summary.accepted).toBe(false);
      expect(summary.expired).toBe(false);
      expect(summary.requiresReconsent).toBe(true);
      expect(summary.text).toBe(TERMS_TEXT_HI);
    });
  });
});
