/**
 * Story 4 AC8 - AdminPanel ReviewPage. NOT EXECUTED IN THE REPO: no @playwright/test is installed
 * (AdminPanel has no Playwright config). The same flow was driven by hand through the Playwright MCP
 * browser, see .loop/test-report.md. To run: install @playwright/test, start
 * `node tests/e2e/admin-review-ui-server.mjs` and `npm --prefix AdminPanel run dev`, then
 * `npx playwright test tests/e2e/admin-review-ui.spec.ts`.
 *
 * AdminPanel hardcodes the API base to http://localhost:3000, so the test redirects it to the test API.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const seed = JSON.parse(readFileSync('.loop/artifacts/ui-seed.json', 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:3000/**', (route) =>
    route.continue({ url: route.request().url().replace('http://localhost:3000/', 'http://127.0.0.1:3101/') }),
  );
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('admin@dhobimatrimony.com').fill(seed.email);
  await page.getByPlaceholder('••••••••').fill(seed.password);
  await page.getByRole('button', { name: 'Sign In to Console' }).click();
  await page.waitForURL('http://localhost:5173/');
});

test('queue is oldest first with an SLA badge per row', async ({ page }) => {
  await page.goto('http://localhost:5173/profiles');
  const rows = page.getByTestId('queue-row');
  await expect(rows.first()).toContainText(/Overdue|At risk|On track/);
  const count = await rows.count();
  for (let i = 0; i < count; i++) await expect(rows.nth(i)).toContainText(/Overdue|At risk|On track/);
});

test('reject and request changes are gated on reason code, notes and section', async ({ page }) => {
  await page.goto(`http://localhost:5173/profiles/${seed.seeds.underAge}`);
  await expect(page.getByTestId('age-check')).toHaveText('Age check: fail');
  await expect(page.getByTestId('masked-id')).toHaveText('****234F');
  await expect(page.getByTestId('decision-reject')).toBeDisabled();
  await expect(page.getByTestId('decision-request-changes')).toBeDisabled();
  await page.getByTestId('reason-code').selectOption('under-age');
  await page.getByTestId('notes').fill('x');
  await page.getByTestId('section-step-1').check();
  await expect(page.getByTestId('decision-reject')).toBeEnabled();
  await expect(page.getByTestId('decision-request-changes')).toBeDisabled(); // under-age not allowed for changes
  await page.getByTestId('reason-code').selectOption('name-mismatch');
  await expect(page.getByTestId('decision-request-changes')).toBeEnabled();
  await page.getByTestId('section-step-1').uncheck();
  await expect(page.getByTestId('decision-request-changes')).toBeDisabled();
});
