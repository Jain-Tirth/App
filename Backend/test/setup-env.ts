/**
 * Jest sets `NODE_ENV=test` before this file runs. The application only accepts
 * `development`, `staging` and `production`, so the test run points itself at
 * `development` — the environment that loads the local `.env` file.
 *
 * This must run before any module imports `src/config/env.ts`.
 */
process.env.NODE_ENV = 'development';

// Required settings with no code default; the values here are test-only.
process.env.STORAGE_PROVIDER = 'fake';
process.env.KYC_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
