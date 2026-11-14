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

  describe('storage and KYC encryption', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const required = {
      DATABASE_URL: 'postgres://example/db',
      JWT_SECRET: 'jwt-secret',
      JWT_REFRESH_SECRET: 'jwt-refresh-secret',
      ADMIN_JWT_SECRET: 'admin-jwt-secret',
    };
    const touched = [
      ...Object.keys(required),
      'AGE_MIN_MALE',
      'AGE_MIN_FEMALE',
      'KYC_ENCRYPTION_KEY',
      'STORAGE_PROVIDER',
      'S3_ENDPOINT',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_S3_BUCKET_DOCUMENTS',
    ];
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
      saved = Object.fromEntries(touched.map((name) => [name, process.env[name]]));
      Object.assign(process.env, required, {
        KYC_ENCRYPTION_KEY: key,
        STORAGE_PROVIDER: 'fake',
      });
      delete process.env.S3_ENDPOINT;
      process.env.AGE_MIN_MALE = '21';
      process.env.AGE_MIN_FEMALE = '18';
    });

    afterEach(() => {
      for (const name of touched) {
        if (saved[name] === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = saved[name];
        }
      }
    });

    it('exposes the storage provider and the decoded encryption key', () => {
      const { env } = loadEnvModule('development');

      expect(env.storage.provider).toBe('fake');
      expect(env.kycEncryptionKey.equals(Buffer.alloc(32, 7))).toBe(true);
    });

    it('refuses to boot without KYC_ENCRYPTION_KEY', () => {
      delete process.env.KYC_ENCRYPTION_KEY;
      const { validateEnv } = loadEnvModule('development');

      expect(() => validateEnv()).toThrow(/KYC_ENCRYPTION_KEY/);
    });

    it('refuses to boot when KYC_ENCRYPTION_KEY is not 32 bytes of base64', () => {
      process.env.KYC_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64');
      const { validateEnv } = loadEnvModule('development');

      expect(() => validateEnv()).toThrow(/KYC_ENCRYPTION_KEY/);
    });

    it('refuses to boot with an unknown STORAGE_PROVIDER', () => {
      process.env.STORAGE_PROVIDER = 'gcs';
      const { validateEnv } = loadEnvModule('development');

      expect(() => validateEnv()).toThrow(/STORAGE_PROVIDER/);
    });

    it('refuses to boot with the s3 provider and no credentials or bucket', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.AWS_ACCESS_KEY_ID = '';
      process.env.AWS_SECRET_ACCESS_KEY = '';
      process.env.AWS_S3_BUCKET_DOCUMENTS = '';
      const { validateEnv } = loadEnvModule('development');

      expect(() => validateEnv()).toThrow(/AWS_ACCESS_KEY_ID/);
    });

    it('accepts the s3 provider with credentials and a bucket', () => {
      process.env.STORAGE_PROVIDER = 's3';
      process.env.AWS_ACCESS_KEY_ID = 'id';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret';
      process.env.AWS_S3_BUCKET_DOCUMENTS = 'bucket';
      const { env } = loadEnvModule('development');

      expect(env.storage.provider).toBe('s3');
      expect(env.storage.bucket).toBe('bucket');
    });

    it('refuses the fake provider in production', () => {
      process.env.STORAGE_PROVIDER = 'fake';
      const { validateEnv } = loadEnvModule('production');

      expect(() => validateEnv()).toThrow(/STORAGE_PROVIDER/);
    });
  });

  describe('age minimums', () => {
    const required = {
      DATABASE_URL: 'postgres://example/db',
      JWT_SECRET: 'jwt-secret',
      JWT_REFRESH_SECRET: 'jwt-refresh-secret',
      ADMIN_JWT_SECRET: 'admin-jwt-secret',
    };
    const touched = [
      ...Object.keys(required),
      'AGE_MIN_MALE',
      'AGE_MIN_FEMALE',
    ];
    let saved: Record<string, string | undefined>;

    beforeEach(() => {
      saved = Object.fromEntries(touched.map((key) => [key, process.env[key]]));
      Object.assign(process.env, required);
      delete process.env.AGE_MIN_MALE;
      delete process.env.AGE_MIN_FEMALE;
    });

    afterEach(() => {
      for (const key of touched) {
        if (saved[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = saved[key];
        }
      }
    });

    it('defaults to 21 for men and 18 for women', () => {
      const { env } = loadEnvModule('development');

      expect(env.ageMinimums).toEqual({ male: 21, female: 18 });
    });

    it('reads AGE_MIN_MALE and AGE_MIN_FEMALE', () => {
      process.env.AGE_MIN_MALE = '22';
      process.env.AGE_MIN_FEMALE = '19';
      const { env } = loadEnvModule('development');

      expect(env.ageMinimums).toEqual({ male: 22, female: 19 });
    });

    it('refuses to boot when AGE_MIN_MALE is not an integer', () => {
      process.env.AGE_MIN_MALE = '21.5';
      const { validateEnv } = loadEnvModule('development');

      expect(() => validateEnv()).toThrow(/AGE_MIN_MALE/);
    });

    it('refuses to boot when AGE_MIN_FEMALE is not a number', () => {
      process.env.AGE_MIN_FEMALE = 'eighteen';
      const { validateEnv } = loadEnvModule('development');

      expect(() => validateEnv()).toThrow(/AGE_MIN_FEMALE/);
    });

    it('refuses to boot when AGE_MIN_MALE is below 18', () => {
      process.env.AGE_MIN_MALE = '17';
      const { validateEnv } = loadEnvModule('development');

      expect(() => validateEnv()).toThrow(/AGE_MIN_MALE/);
    });

    it('refuses to boot when AGE_MIN_FEMALE is below 18', () => {
      process.env.AGE_MIN_FEMALE = '16';
      const { validateEnv } = loadEnvModule('development');

      expect(() => validateEnv()).toThrow(/AGE_MIN_FEMALE/);
    });
  });
});
