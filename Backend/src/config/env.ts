import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * The only environments the API may run in. `NODE_ENV` is never defaulted in
 * code: it is supplied by the runtime (deployment, container, CI) or, locally,
 * declared by `.env` itself.
 */
const nodeEnvSchema = z.enum(['development', 'staging', 'production']);

export type NodeEnv = z.infer<typeof nodeEnvSchema>;

/** Exactly one env file per environment. Nothing is merged or layered. */
const envFileByNodeEnv: Record<NodeEnv, string> = {
  development: '.env',
  staging: '.env.staging',
  production: '.env.production',
};

// `NODE_ENV` decides which file to read, so it must be known before the
// environment-specific file is loaded. A deployment sets it in the process
// environment; on a developer machine it is declared by `.env`.
if (!process.env.NODE_ENV) {
  loadDotenv({ path: resolve(process.cwd(), envFileByNodeEnv.development), quiet: true });
}

const parsedNodeEnv = nodeEnvSchema.safeParse(process.env.NODE_ENV);

if (!parsedNodeEnv.success) {
  throw new Error(
    `Invalid NODE_ENV "${process.env.NODE_ENV ?? ''}". ` +
      `Expected one of: ${nodeEnvSchema.options.join(', ')}.`,
  );
}

export const nodeEnv: NodeEnv = parsedNodeEnv.data;

/** The env file that matches `NODE_ENV`, e.g. `.env.production`. */
export const envFile = envFileByNodeEnv[nodeEnv];

export const envFilePath = resolve(process.cwd(), envFile);

// `dotenv` never overrides a variable that is already set, so an explicit
// `DATABASE_URL=... npm run start` or the test harness still wins.
loadDotenv({ path: envFilePath, quiet: true });

export const isProduction = nodeEnv === 'production';

/** Treats an empty value the same as an absent one. */
const optionalString = (fallback: string) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().default(fallback),
  );

const optionalPort = (fallback: number) =>
  z.preprocess(
    (value) =>
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
        ? fallback
        : value,
    z.coerce.number().int().positive(),
  );

/**
 * The full environment contract. Every variable the API reads is declared here,
 * once, with its type, requiredness and default.
 */
const envSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: optionalPort(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: optionalString('redis://localhost:6379'),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: optionalString('7d'),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: optionalString('30d'),
  ADMIN_JWT_SECRET: z.string().min(1),
  ADMIN_JWT_EXPIRES_IN: optionalString('12h'),
  ADMIN_EMAIL: optionalString(''),
  ADMIN_PASSWORD: optionalString(''),
  ADMIN_NAME: optionalString('Admin User'),
  AWS_ACCESS_KEY_ID: optionalString(''),
  AWS_SECRET_ACCESS_KEY: optionalString(''),
  AWS_REGION: optionalString('ap-south-1'),
  AWS_S3_BUCKET_PHOTOS: optionalString(''),
  AWS_S3_BUCKET_DOCUMENTS: optionalString(''),
  FCM_PROJECT_ID: optionalString(''),
  FCM_CLIENT_EMAIL: optionalString(''),
  FCM_PRIVATE_KEY: optionalString(''),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

/**
 * Validates the process environment with zod and caches the result.
 *
 * Validation is lazy so that importing this module (for `envFilePath`, or from a
 * unit test that never touches configuration) does not require a populated env
 * file; `validateEnv()` calls it eagerly at bootstrap so a misconfigured
 * deployment fails before the HTTP server starts.
 */
export function loadEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid environment for NODE_ENV=${nodeEnv} (loaded ${envFilePath}):\n${issues}`,
    );
  }

  cachedEnv = result.data;

  return cachedEnv;
}

/**
 * Fails fast at bootstrap when the environment does not satisfy `envSchema`.
 * Call this from `main.ts` before the Nest application is created.
 */
export function validateEnv(): void {
  loadEnv();
}

/**
 * Typed view of the environment. Values are resolved from the validated schema
 * on first access, so a missing or malformed variable throws with the variable
 * name instead of silently becoming `undefined`.
 */
export const env = {
  get nodeEnv(): NodeEnv {
    return nodeEnv;
  },
  get isProduction(): boolean {
    return isProduction;
  },
  get envFile(): string {
    return envFile;
  },
  get port(): number {
    return loadEnv().PORT;
  },
  get databaseUrl(): string {
    return loadEnv().DATABASE_URL;
  },
  get redisUrl(): string {
    return loadEnv().REDIS_URL;
  },
  get jwt() {
    const parsed = loadEnv();

    return {
      secret: parsed.JWT_SECRET,
      expiresIn: parsed.JWT_EXPIRES_IN,
      refreshSecret: parsed.JWT_REFRESH_SECRET,
      refreshExpiresIn: parsed.JWT_REFRESH_EXPIRES_IN,
    };
  },
  get admin() {
    const parsed = loadEnv();

    return {
      jwtSecret: parsed.ADMIN_JWT_SECRET,
      jwtExpiresIn: parsed.ADMIN_JWT_EXPIRES_IN,
      email: parsed.ADMIN_EMAIL,
      password: parsed.ADMIN_PASSWORD,
      name: parsed.ADMIN_NAME,
    };
  },
  get aws() {
    const parsed = loadEnv();

    return {
      accessKeyId: parsed.AWS_ACCESS_KEY_ID,
      secretAccessKey: parsed.AWS_SECRET_ACCESS_KEY,
      region: parsed.AWS_REGION,
      photosBucket: parsed.AWS_S3_BUCKET_PHOTOS,
      documentsBucket: parsed.AWS_S3_BUCKET_DOCUMENTS,
    };
  },
  get fcm() {
    const parsed = loadEnv();

    return {
      projectId: parsed.FCM_PROJECT_ID,
      clientEmail: parsed.FCM_CLIENT_EMAIL,
      privateKey: parsed.FCM_PRIVATE_KEY,
    };
  },
} as const;
