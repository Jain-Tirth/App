import { defineConfig } from '@playwright/test';

/**
 * Story 10 (PWA install, offline banner, update prompt). Run with: node tests/e2e/run-story10-ui.mjs
 * Servers: test API harness (3101, test DB, fake storage) and the BUILT UserWeb (.loop/artifacts/dist10, built by the
 * launcher with VITE_BASE_URL -> 3101) served by static-server.mjs on 5191. Ports 3000 and 5173 untouched.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  outputDir: '../../../.loop/artifacts/playwright-results-10',
  use: { baseURL: 'http://localhost:5191', viewport: { width: 360, height: 780 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/e2e/admin-review-ui-server.mjs', url: 'http://127.0.0.1:3101/api/v1/consents/current', timeout: 120_000, reuseExistingServer: false, cwd: '../../..' },
    { command: 'node tests/e2e/story10/static-server.mjs .loop/artifacts/dist10 5191', url: 'http://127.0.0.1:5191/', timeout: 60_000, reuseExistingServer: false, cwd: '../../..' },
  ],
});
