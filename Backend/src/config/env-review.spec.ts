type EnvModule = typeof import('./env');

const REQUIRED = {
  DATABASE_URL: 'postgres://unused',
  JWT_SECRET: 'a',
  JWT_REFRESH_SECRET: 'b',
  ADMIN_JWT_SECRET: 'c',
};
const REVIEW_KEYS = [
  'REVIEW_SLA_HOURS',
  'REVIEW_BUSINESS_DAYS',
  'REVIEW_BUSINESS_START',
  'REVIEW_BUSINESS_END',
  'REVIEW_TIMEZONE',
];

function withEnv(overrides: Record<string, string>): EnvModule {
  jest.resetModules();
  for (const key of REVIEW_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, REQUIRED, overrides);

  return require('./env') as EnvModule;
}

describe('review business-hours settings', () => {
  afterEach(() => {
    for (const key of REVIEW_KEYS) {
      delete process.env[key];
    }
  });

  it('defaults to 48h, Mon-Fri 09:00-18:00 Asia/Kolkata', () => {
    expect(withEnv({}).env.review).toEqual({
      slaHours: 48,
      days: [1, 2, 3, 4, 5],
      startMinute: 540,
      endMinute: 1080,
      timeZone: 'Asia/Kolkata',
    });
  });

  it('reads overrides', () => {
    const { env } = withEnv({
      REVIEW_SLA_HOURS: '24',
      REVIEW_BUSINESS_DAYS: '1,2,3',
      REVIEW_BUSINESS_START: '10:30',
      REVIEW_BUSINESS_END: '16:00',
      REVIEW_TIMEZONE: 'UTC',
    });

    expect(env.review).toEqual({
      slaHours: 24,
      days: [1, 2, 3],
      startMinute: 630,
      endMinute: 960,
      timeZone: 'UTC',
    });
  });

  it.each([
    ['REVIEW_TIMEZONE', 'Mars/Olympus'],
    ['REVIEW_BUSINESS_START', '9am'],
    ['REVIEW_BUSINESS_DAYS', '0,8'],
    ['REVIEW_SLA_HOURS', '0'],
  ])('fails boot validation for a bad %s', (key, value) => {
    const { loadEnv } = withEnv({ [key]: value });

    expect(() => loadEnv()).toThrow(new RegExp(key));
  });

  it('fails when the window closes before it opens', () => {
    const { loadEnv } = withEnv({
      REVIEW_BUSINESS_START: '18:00',
      REVIEW_BUSINESS_END: '09:00',
    });

    expect(() => loadEnv()).toThrow(/REVIEW_BUSINESS_END/);
  });
});
