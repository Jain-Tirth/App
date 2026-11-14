import { defineConfig } from '@playwright/test';

/**
 * Run from the repo root: npx playwright test -c tests/e2e/playwright.config.ts
 * Starts the test-API harness (port 3101, fake storage, seeds .loop/artifacts/ui-seed.json) and the
 * AdminPanel dev server with VITE_BASE_URL forced to the test API (a process env var overrides AdminPanel/.env).
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  testIgnore: '**/userweb/**',
  workers: 1,
  outputDir: '../../.loop/artifacts/playwright-results',
  use: { baseURL: 'http://localhost:5183', screenshot: 'on', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node tests/e2e/admin-review-ui-server.mjs',
      url: 'http://127.0.0.1:3101/api/v1/consents/current',
      ignoreHTTPSErrors: true,
      timeout: 120_000,
      reuseExistingServer: false,
      cwd: '../..',
    },
    {
      command: 'npm --prefix AdminPanel run dev -- --port 5183 --strictPort',
      url: 'http://localhost:5183/login',
      timeout: 120_000,
      reuseExistingServer: false,
      cwd: '../..',
      env: { VITE_BASE_URL: 'http://127.0.0.1:3101' },
    },
  ],
});
