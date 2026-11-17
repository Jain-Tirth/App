import { defineConfig } from '@playwright/test';

/**
 * Story 9b (member UI for account settings, logout-all, export, delete).
 * Run with: node tests/e2e/run-story9b-ui.mjs   (uses AdminPanel's @playwright/test and @axe-core/playwright)
 * Servers: test API harness (3101, test DB, fake storage) and UserWeb dev on 5190 pointed at it. Ports 3000 and 5173 untouched.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  outputDir: '../../../.loop/artifacts/playwright-results-9b',
  use: { baseURL: 'http://localhost:5190', viewport: { width: 360, height: 780 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/e2e/admin-review-ui-server.mjs', url: 'http://127.0.0.1:3101/api/v1/consents/current', timeout: 120_000, reuseExistingServer: false, cwd: '../../..' },
    { command: 'npm --prefix UserWeb run dev -- --port 5190 --strictPort', url: 'http://localhost:5190/', timeout: 120_000, reuseExistingServer: false, cwd: '../../..', env: { VITE_BASE_URL: 'http://127.0.0.1:3101/api/v1' } },
  ],
});
