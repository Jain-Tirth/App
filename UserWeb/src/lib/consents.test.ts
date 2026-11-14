import { describe, expect, it } from 'vitest';
import { buildConsentPayload, codesNeedingConsent } from './consents';

const docs = [
  { code: 'terms', version: '1.0', hash: 'h1', text: 't' },
  { code: 'privacy', version: '2.0', hash: 'h2', text: 'p' },
  { code: 'id_processing', version: '1.1', hash: 'h3', text: 'i' },
];

describe('buildConsentPayload', () => {
  it('returns one entry per required code with the shown version and hash', () => {
    expect(
      buildConsentPayload(docs, { terms: true, privacy: true, id_processing: true }),
    ).toEqual([
      { code: 'terms', version: '1.0', documentHash: 'h1' },
      { code: 'privacy', version: '2.0', documentHash: 'h2' },
      { code: 'id_processing', version: '1.1', documentHash: 'h3' },
    ]);
  });

  it('returns null while any box is unticked', () => {
    expect(buildConsentPayload(docs, { terms: true, privacy: true })).toBeNull();
    expect(
      buildConsentPayload(docs, { terms: true, privacy: false, id_processing: true }),
    ).toBeNull();
  });

  it('returns null when a required document was not loaded', () => {
    expect(
      buildConsentPayload(docs.slice(0, 2), { terms: true, privacy: true, id_processing: true }),
    ).toBeNull();
  });
});

describe('codesNeedingConsent', () => {
  it('lists unaccepted, expired and re-consent codes', () => {
    expect(
      codesNeedingConsent([
        { code: 'terms', accepted: true, expired: false, requiresReconsent: false },
        { code: 'privacy', accepted: true, expired: true, requiresReconsent: false },
        { code: 'id_processing', accepted: true, expired: false, requiresReconsent: true },
        { code: 'extra', accepted: false, expired: false, requiresReconsent: false },
      ]),
    ).toEqual(['privacy', 'id_processing', 'extra']);
  });
});
