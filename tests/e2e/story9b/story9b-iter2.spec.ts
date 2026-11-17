/**
 * Story 9b iteration 2: reviewer findings (focus return, cancel 404 recheck, in-flight guard, same dialog on all flows).
 * Real backend, one member per test, sequential.
 * page.route use: ONLY (a) delaying a real request with route.continue after a wait (in-flight tests) and
 * (b) one FULFILLED synthetic 500 for the failed-cancel focus test. The 404 DELETE_REQUEST_NOT_FOUND test uses NO page.route:
 * the member's request is cancelled through the real API first, then the UI Cancel button gets the real 404.
 */
import { expect, test, type Page } from '@playwright/test';
import { MSG, approved, call, track, uiLogin } from './support9b';

const dlg = (page: Page) => page.getByTestId('stepup-dialog');
const pwField = (page: Page) => dlg(page).getByTestId('stepup-password');

async function openExport(page: Page, name = 'Download my data') {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
  await page.getByRole('button', { name, exact: true }).first().click();
  await expect(dlg(page)).toBeVisible();
}

async function failedThenRefocusedThenEscape(page: Page) {
  await expect(dlg(page).getByTestId('stepup-error')).toBeVisible();
  await expect(pwField(page)).toBeFocused();
  await expect(pwField(page)).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(dlg(page)).toHaveCount(0);
}

test.describe('story 9b iteration 2', () => {
  test('focus returns to the password field after wrong password (export), field empty, Escape closes', async ({ page }) => {
    const m = await approved();
    await uiLogin(page, m);
    await openExport(page);
    await pwField(page).fill('WrongPass444');
    await dlg(page).getByTestId('stepup-submit').click();
    await failedThenRefocusedThenEscape(page);
  });

  test('focus returns to the password field after wrong password (delete), field empty, Escape closes', async ({ page }) => {
    const m = await approved();
    await uiLogin(page, m);
    await openExport(page, 'Delete my account');
    await pwField(page).fill('WrongPass555');
    await dlg(page).getByTestId('stepup-submit').click();
    await failedThenRefocusedThenEscape(page);
  });

  test('focus returns to the password field after REQUEST_ALREADY_PENDING (real)', async ({ page }) => {
    const m = await approved();
    const first = await call('POST', '/account/export-request', { token: m.token, body: { password: m.password } });
    expect(first.status).toBe(202);
    await uiLogin(page, m);
    await openExport(page);
    await pwField(page).fill(m.password);
    await dlg(page).getByTestId('stepup-submit').click();
    await expect(dlg(page).getByTestId('stepup-error')).toContainText(MSG.alreadyPending);
    await failedThenRefocusedThenEscape(page);
  });

  test('focus returns to the password field after RATE_LIMITED (real) and Escape closes', async ({ page }) => {
    const m = await approved();
    await uiLogin(page, m);
    await openExport(page);
    for (let i = 0; i < 8; i++) {
      await pwField(page).fill(`Wrong${i}Pass1`);
      await dlg(page).getByTestId('stepup-submit').click();
      const err = dlg(page).getByTestId('stepup-error');
      await expect(err).toBeVisible();
      await expect(pwField(page)).toBeFocused();
      const t = (await err.innerText()).split(/\n\s*Reference:/)[0].trim();
      if (MSG.rate.test(t)) break;
    }
    await expect(dlg(page).getByTestId('stepup-error')).toContainText(/Too many attempts/);
    await failedThenRefocusedThenEscape(page);
  });

  test('in-flight: second Enter and click send nothing extra, busy state conveyed', async ({ page }) => {
    const m = await approved();
    const log = track(page);
    await uiLogin(page, m);
    await openExport(page);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    await page.route('**/account/export-request', async (route) => {
      await gate;
      await route.continue();
    });
    await pwField(page).fill(m.password);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await dlg(page).getByTestId('stepup-submit').click({ force: true }).catch(() => undefined);
    await page.keyboard.press('Enter');
    const state = await page.evaluate(() => {
      const d = document.querySelector('[data-testid=stepup-dialog]') as HTMLElement;
      const b = document.querySelector('[data-testid=stepup-submit]') as HTMLButtonElement;
      const p = document.querySelector('[data-testid=stepup-password]') as HTMLInputElement;
      return {
        dialogAriaBusy: d.getAttribute('aria-busy'), submitDisabled: b.disabled, submitAriaDisabled: b.getAttribute('aria-disabled'),
        submitAriaBusy: b.getAttribute('aria-busy'), submitText: b.innerText, passwordDisabled: p.disabled, passwordReadOnly: p.readOnly,
      };
    });
    test.info().annotations.push({ type: 'in-flight-state', description: JSON.stringify(state) });
    expect(state.submitDisabled || state.submitAriaDisabled === 'true' || state.submitAriaBusy === 'true' || state.dialogAriaBusy === 'true').toBe(true);
    expect(log.filter((l) => l.method === 'POST' && l.path.includes('export-request'))).toHaveLength(1);
    release();
    await expect(dlg(page)).toHaveCount(0);
    await expect(page.getByTestId('export-received')).toBeVisible();
    expect(log.filter((l) => l.method === 'POST' && l.path.includes('export-request'))).toHaveLength(1);
  });

  test('in-flight on delete: repeated Enter sends exactly one delete-request', async ({ page }) => {
    const m = await approved();
    const log = track(page);
    await uiLogin(page, m);
    await openExport(page, 'Delete my account');
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    await page.route('**/account/delete-request', async (route) => {
      await gate;
      await route.continue();
    });
    await pwField(page).fill(m.password);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    expect(log.filter((l) => l.method === 'POST' && l.path.includes('delete-request'))).toHaveLength(1);
    release();
    await page.waitForURL(/\/account-deletion/);
    expect(log.filter((l) => l.method === 'POST' && l.path.includes('delete-request'))).toHaveLength(1);
  });

  test('failed cancel (mocked 500) returns focus to the Cancel deletion button, retry works', async ({ page }) => {
    const m = await approved();
    const r = await call('POST', '/account/delete-request', { token: m.token, body: { password: m.password } });
    expect(r.status).toBe(202);
    await uiLogin(page, m, /\/account-deletion/);
    let failed = false;
    await page.route('**/account/delete-request', async (route) => {
      if (route.request().method() === 'DELETE' && !failed) {
        failed = true;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, error: 'INTERNAL_ERROR', message: 'boom' }) });
      } else await route.continue();
    });
    await page.getByTestId('cancel-deletion').click();
    await expect(page.getByTestId('deletion-error')).toBeVisible();
    await expect(page.getByTestId('cancel-deletion')).toBeFocused();
    await page.getByTestId('cancel-deletion').click();
    await page.waitForURL(/\/app/);
  });

  test('real 404 DELETE_REQUEST_NOT_FOUND on cancel (cancelled elsewhere first, no page.route) rechecks and lands in the app', async ({ page }) => {
    const m = await approved();
    const r = await call('POST', '/account/delete-request', { token: m.token, body: { password: m.password } });
    expect(r.status).toBe(202);
    await uiLogin(page, m, /\/account-deletion/);
    const log = track(page);
    // cancel through the real API from "another device"
    const login = await call('POST', '/auth/login', { body: { email: m.email, password: m.password } });
    const tok = (login.body.tokens ?? login.body).accessToken as string;
    // the login of a pending member may answer 403 with a token-less body; fall back to the original token
    const cancelled = await call('DELETE', '/account/delete-request', { token: login.status < 300 ? tok : m.token });
    test.info().annotations.push({ type: 'cancel-elsewhere', description: `${cancelled.status} ${cancelled.text.slice(0, 120)}` });
    expect(cancelled.status).toBeLessThan(300);
    const resp = page.waitForResponse((x) => x.request().method() === 'DELETE' && x.url().includes('/account/delete-request'));
    await page.getByTestId('cancel-deletion').click();
    const got = await resp;
    test.info().annotations.push({ type: 'ui-cancel-status', description: `${got.status()} ${(await got.text()).slice(0, 160)}` });
    expect(got.status()).toBe(404);
    await page.waitForURL(/\/app/);
    await expect(page.getByTestId('cancel-deletion')).toHaveCount(0);
    test.info().annotations.push({ type: 'requests-after-404', description: JSON.stringify(log.map((l) => `${l.method} ${l.path}`)) });
  });

  test('logout-all and delete flows use the same fixed step-up behaviour (logout-all confirm closes with Escape, no extra requests)', async ({ page }) => {
    const m = await approved();
    const log = track(page);
    await uiLogin(page, m);
    await page.goto('/settings');
    await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
    await page.getByRole('button', { name: 'Log out of all devices' }).click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    const n = log.length;
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
    expect(log.slice(n).filter((l) => l.method !== 'GET')).toEqual([]);
    await page.getByRole('button', { name: 'Log out of all devices' }).click();
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Log out everywhere' }).click();
    await page.waitForURL(/\/login/);
  });
});
