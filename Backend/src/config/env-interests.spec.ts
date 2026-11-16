type EnvModule = typeof import('./env');

const REQUIRED = {
  DATABASE_URL: 'postgres://unused',
  JWT_SECRET: 'a',
  JWT_REFRESH_SECRET: 'b',
  ADMIN_JWT_SECRET: 'c',
};

function withEnv(overrides: Record<string, string>): EnvModule {
  jest.resetModules();
  delete process.env.INTEREST_RESEND_COOLDOWN_DAYS;
  delete process.env.INTEREST_DAILY_SEND_LIMIT;
  Object.assign(process.env, REQUIRED, overrides);

  return require('./env') as EnvModule;
}

describe('interest configuration', () => {
  afterEach(() => {
    delete process.env.INTEREST_RESEND_COOLDOWN_DAYS;
    delete process.env.INTEREST_DAILY_SEND_LIMIT;
  });

  it('defaults to a 30 day cooldown and no send limit', () => {
    expect(withEnv({}).env.interests).toEqual({
      resendCooldownDays: 30,
      dailySendLimit: null,
    });
  });

  it('treats an empty limit as unset', () => {
    expect(withEnv({ INTEREST_DAILY_SEND_LIMIT: '' }).env.interests.dailySendLimit).toBeNull();
  });

  it('reads overrides', () => {
    expect(
      withEnv({ INTEREST_RESEND_COOLDOWN_DAYS: '7', INTEREST_DAILY_SEND_LIMIT: '50' }).env
        .interests,
    ).toEqual({ resendCooldownDays: 7, dailySendLimit: 50 });
  });

  it.each(['0', '-1', 'ten'])('rejects a limit of %s at boot', (value) => {
    const { loadEnv } = withEnv({ INTEREST_DAILY_SEND_LIMIT: value });

    expect(() => loadEnv()).toThrow(/INTEREST_DAILY_SEND_LIMIT/);
  });
});
