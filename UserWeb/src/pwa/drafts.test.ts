import { describe, expect, it } from 'vitest';
import { createDraftService, createMemoryDraftStore, sanitizeDraft } from './drafts';

const ALLOWED = { step3: ['country', 'state', 'city'], step5: ['aboutMyself'] };

describe('sanitizeDraft', () => {
  it('keeps allow-listed primitive fields only', () => {
    const clean = sanitizeDraft(
      {
        step3: { state: 'Gujarat', city: 'Surat', aadhaarNumber: '1234 5678 9012', nested: { a: 1 } },
        panCard: { number: 'ABCDE1234F' },
        step5: { aboutMyself: 'Hello', documentFileName: 'aadhaar.pdf' },
      },
      ALLOWED,
    );
    expect(clean).toEqual({ step3: { state: 'Gujarat', city: 'Surat' }, step5: { aboutMyself: 'Hello' } });
    expect(JSON.stringify(clean)).not.toMatch(/aadhaar|pan|1234/i);
  });

  it('returns an empty object for junk input', () => {
    expect(sanitizeDraft(null, ALLOWED)).toEqual({});
    expect(sanitizeDraft('text', ALLOWED)).toEqual({});
  });
});

describe('createDraftService', () => {
  it('keeps drafts per user, so another member sees none', async () => {
    const service = createDraftService(createMemoryDraftStore());
    await service.save('user-a', 'wizard', { step3: { city: 'Surat' } }, ALLOWED);
    expect(await service.load('user-a', 'wizard', ALLOWED)).toEqual({ step3: { city: 'Surat' } });
    expect(await service.load('user-b', 'wizard', ALLOWED)).toBeNull();
  });

  it('clearAll removes every member draft (logout)', async () => {
    const service = createDraftService(createMemoryDraftStore());
    await service.save('user-a', 'wizard', { step3: { city: 'Surat' } }, ALLOWED);
    await service.save('user-b', 'wizard', { step3: { city: 'Pune' } }, ALLOWED);
    await service.clearAll();
    expect(await service.load('user-a', 'wizard', ALLOWED)).toBeNull();
    expect(await service.load('user-b', 'wizard', ALLOWED)).toBeNull();
  });

  it('discard removes one draft', async () => {
    const service = createDraftService(createMemoryDraftStore());
    await service.save('user-a', 'wizard', { step3: { city: 'Surat' } }, ALLOWED);
    await service.discard('user-a', 'wizard');
    expect(await service.load('user-a', 'wizard', ALLOWED)).toBeNull();
  });
});
