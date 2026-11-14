import { defineConfig } from '@playwright/test';

/**
 * UserWeb member UI (phase 1 story 1b).
 * Run from UserWeb/ (it resolves @playwright/test):
 *   cd UserWeb; npx playwright test -c ../tests/e2e/userweb/playwright.config.ts
 *
 * Starts the test-API harness (port 3101, test database, STORAGE_PROVIDER=fake; it also seeds an
 * admin into .loop/artifacts/ui-seed.json) and the UserWeb dev server on 5190 with VITE_BASE_URL
 * forced to the test API through the process env. The human's servers (5173, 3000) are untouched.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: '../../../.loop/artifacts/playwright-results-userweb',
  use: {
    baseURL: 'http://localhost:5190',
    viewport: { width: 360, height: 780 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node tests/e2e/admin-review-ui-server.mjs',
      url: 'http://127.0.0.1:3101/api/v1/consents/current',
      timeout: 120_000,
      reuseExistingServer: false,
      cwd: '../../..',
    },
    {
      command: 'npm --prefix UserWeb run dev -- --port 5190 --strictPort',
      url: 'http://localhost:5190/',
      timeout: 120_000,
      reuseExistingServer: false,
      cwd: '../../..',
      env: { VITE_BASE_URL: 'http://127.0.0.1:3101/api/v1' },
    },
  ],
});
