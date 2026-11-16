type EnvModule = typeof import('./env');

const REQUIRED = {
  DATABASE_URL: 'postgres://unused',
  JWT_SECRET: 'a',
  JWT_REFRESH_SECRET: 'b',
  ADMIN_JWT_SECRET: 'c',
};

const NAMES = [
  'ACCOUNT_DELETION_COOLING_OFF_DAYS',
  'ACCOUNT_EXPORT_LINK_HOURS',
  'ACCOUNT_STEP_UP_MAX_FAILURES',
  'ACCOUNT_STEP_UP_WINDOW_MINUTES',
];

function clear(): void {
  for (const name of NAMES) {
    delete process.env[name];
  }
}

function withEnv(overrides: Record<string, string>): EnvModule {
  jest.resetModules();
  clear();
  Object.assign(process.env, REQUIRED, overrides);

  return require('./env') as EnvModule;
}

describe('account configuration', () => {
  afterEach(clear);

  it('defaults to a 30 day cooling-off, a 24 hour link and 5 failures in 15 minutes', () => {
    expect(withEnv({}).env.account).toEqual({
      deletionCoolingOffDays: 30,
      exportLinkHours: 24,
      stepUpMaxFailures: 5,
      stepUpWindowMinutes: 15,
    });
  });

  it('reads a configured cooling-off', () => {
    expect(
      withEnv({ ACCOUNT_DELETION_COOLING_OFF_DAYS: '7' }).env.account
        .deletionCoolingOffDays,
    ).toBe(7);
  });

  it.each(['0', 'soon'])('rejects a cooling-off of %s at boot', (value) => {
    const { loadEnv } = withEnv({ ACCOUNT_DELETION_COOLING_OFF_DAYS: value });

    expect(() => loadEnv()).toThrow(/ACCOUNT_DELETION_COOLING_OFF_DAYS/);
  });
});
