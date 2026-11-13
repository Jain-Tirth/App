import { join } from 'node:path';

type EnvModule = typeof import('./env');

/**
 * Re-evaluates `env.ts` with a specific `NODE_ENV`.
 *
 * `env.ts` resolves the environment file once, at import time, so each case has
 * to load a fresh copy of the module. `NODE_ENV` is restored afterwards so the
 * rest of the suite keeps running against the local `.env`.
 */
function loadEnvModule(nodeEnv: string): EnvModule {
  const previous = process.env.NODE_ENV;
  jest.resetModules();
  process.env.NODE_ENV = nodeEnv;

  try {
    return require('./env') as EnvModule;
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
}

describe('env', () => {
  it('loads .env for development', () => {
    const { nodeEnv, envFile, envFilePath } = loadEnvModule('development');

    expect(nodeEnv).toBe('development');
    expect(envFile).toBe('.env');
    expect(envFilePath).toBe(join(process.cwd(), '.env'));
  });

  it('loads .env.staging for staging', () => {
    const { nodeEnv, envFile } = loadEnvModule('staging');

    expect(nodeEnv).toBe('staging');
    expect(envFile).toBe('.env.staging');
  });

  it('loads .env.production for production', () => {
    const { nodeEnv, envFile, isProduction } = loadEnvModule('production');

    expect(nodeEnv).toBe('production');
    expect(envFile).toBe('.env.production');
    expect(isProduction).toBe(true);
  });

  it('rejects any NODE_ENV outside development, staging and production', () => {
    expect(() => loadEnvModule('test')).toThrow(/Invalid NODE_ENV "test"/);
    expect(() => loadEnvModule('prod')).toThrow(/Invalid NODE_ENV "prod"/);
  });

  it('validates required variables through the zod schema', () => {
    const { loadEnv } = loadEnvModule('development');
    const originalDatabaseUrl = process.env.DATABASE_URL;

    delete process.env.DATABASE_URL;

    try {
      expect(() => loadEnv()).toThrow(/DATABASE_URL/);
    } finally {
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    }
  });
});
