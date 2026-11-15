type EnvModule = typeof import('./env');

const REQUIRED = {
  DATABASE_URL: 'postgres://unused',
  JWT_SECRET: 'a',
  JWT_REFRESH_SECRET: 'b',
  ADMIN_JWT_SECRET: 'c',
};

function withEnv(overrides: Record<string, string>): EnvModule {
  jest.resetModules();
  delete process.env.DAILY_RECOMMENDATIONS;
  Object.assign(process.env, REQUIRED, overrides);

  return require('./env') as EnvModule;
}

describe('DAILY_RECOMMENDATIONS', () => {
  afterEach(() => {
    delete process.env.DAILY_RECOMMENDATIONS;
  });

  it('is 9 when unset', () => {
    expect(withEnv({}).env.dailyRecommendations).toBe(9);
  });

  it('reads an override', () => {
    expect(withEnv({ DAILY_RECOMMENDATIONS: '5' }).env.dailyRecommendations).toBe(
      5,
    );
  });

  it.each(['0', '-3', 'nine', '2.5'])(
    'fails boot validation for %s',
    (value) => {
      const { loadEnv } = withEnv({ DAILY_RECOMMENDATIONS: value });

      expect(() => loadEnv()).toThrow(/DAILY_RECOMMENDATIONS/);
    },
  );
});
