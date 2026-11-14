import { FakeKycProvider, ManualKycProvider } from './kyc.provider';

describe('ManualKycProvider', () => {
  const provider = new ManualKycProvider();

  it('creates a local session id', async () => {
    const first = await provider.createSession();
    const second = await provider.createSession();

    expect(first.sessionId).toMatch(/^manual-[0-9a-f-]{36}$/);
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it('routes submitted media to review', async () => {
    expect(
      await provider.submitDocument({ sessionId: 's', mediaId: 'm1', side: 'front' }),
    ).toEqual({ mediaId: 'm1', outcome: 'needsReview' });
    expect(await provider.submitSelfie({ sessionId: 's', mediaId: 'm2' })).toEqual({
      mediaId: 'm2',
      outcome: 'needsReview',
    });
  });

  it('reports needsReview as the result and ignores webhooks', async () => {
    expect(await provider.getResult('s')).toEqual({
      sessionId: 's',
      outcome: 'needsReview',
    });
    expect(provider.parseWebhook()).toEqual({ sessionId: '', outcome: 'needsReview' });
  });
});

describe('FakeKycProvider', () => {
  it('returns the configured outcome and records calls', async () => {
    const fake = new FakeKycProvider('failed');
    const { sessionId } = await fake.createSession({ userId: 'u1', language: 'en' });

    expect(sessionId).toBe('fake-session-1');
    expect((await fake.submitDocument({ sessionId, mediaId: 'm', side: 'front' })).outcome).toBe('failed');
    expect((await fake.submitSelfie({ sessionId, mediaId: 'p' })).outcome).toBe('failed');
    expect((await fake.getResult(sessionId)).outcome).toBe('failed');
    expect(fake.parseWebhook().outcome).toBe('failed');
    expect(fake.calls).toEqual([
      'createSession:u1',
      'submitDocument:m',
      'submitSelfie:p',
    ]);
  });
});
