type EnvModule = typeof import('./env');

const REQUIRED = {
  DATABASE_URL: 'postgres://unused',
  JWT_SECRET: 'a',
  JWT_REFRESH_SECRET: 'b',
  ADMIN_JWT_SECRET: 'c',
};

function clear(): void {
  delete process.env.SHORTLIST_MAX_LISTS;
  delete process.env.SHORTLIST_MAX_PROFILES;
}

function withEnv(overrides: Record<string, string>): EnvModule {
  jest.resetModules();
  clear();
  Object.assign(process.env, REQUIRED, overrides);

  return require('./env') as EnvModule;
}

describe('shortlist configuration', () => {
  afterEach(clear);

  it('defaults to no limits', () => {
    expect(withEnv({}).env.shortlists).toEqual({ maxLists: null, maxProfiles: null });
  });

  it('treats empty values as unset', () => {
    expect(
      withEnv({ SHORTLIST_MAX_LISTS: '', SHORTLIST_MAX_PROFILES: '' }).env.shortlists,
    ).toEqual({ maxLists: null, maxProfiles: null });
  });

  it('reads configured limits', () => {
    expect(
      withEnv({ SHORTLIST_MAX_LISTS: '10', SHORTLIST_MAX_PROFILES: '200' }).env.shortlists,
    ).toEqual({ maxLists: 10, maxProfiles: 200 });
  });

  it.each(['0', 'many'])('rejects a limit of %s at boot', (value) => {
    const { loadEnv } = withEnv({ SHORTLIST_MAX_LISTS: value });

    expect(() => loadEnv()).toThrow(/SHORTLIST_MAX_LISTS/);
  });
});
