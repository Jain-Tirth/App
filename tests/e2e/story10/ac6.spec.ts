/**
 * Phase 1 story 10, AC6: install prompt. Real backend (3101), built app (5191). beforeinstallprompt is a synthetic event
 * dispatched on window (headless Chromium never fires the real one); appinstalled likewise. iOS uses user-agent emulation.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  IOS_UA, approved, attachShot, call, completeProfile, ctl, fireInstallEvent, firstVisit, newMember, stubFonts, submitted, uiLogin,
} from './support10';

test.beforeEach(async ({ context }) => {
  await ctl('reset');
  await stubFonts(context);
});

const prompt = (page: Page) => page.getByTestId('install-prompt');
const noPrompt = async (page: Page) => expect(prompt(page)).toHaveCount(0);

test('AC6 not on first load or login even with the event captured; appears on the PendingPage after sign-in (SPA, no reload)', async ({ page }) => {
  const m = await submitted();
  await firstVisit(page, '/');
  await fireInstallEvent(page);
  await page.waitForTimeout(500); // bounded negative check
  await noPrompt(page);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await noPrompt(page);
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/pending/);
  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page)).toHaveAttribute('data-mode', 'native');
  await expect(prompt(page)).toContainText('Install Dhobi Matrimony');
  await expect(page.getByTestId('install-button')).toBeVisible();
  await attachShot(page, 'ac6-install-native-pending');
});

test('AC6 not during onboarding (wizard steps and KYC) for a draft member', async ({ page }) => {
  const m = await newMember();
  await firstVisit(page, '/login');
  await fireInstallEvent(page);
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/register/);
  await expect(page.getByTestId('wizard-dob')).toBeVisible();
  await page.waitForTimeout(500);
  await noPrompt(page);
  await completeProfile(m);
  await page.goto('/kyc');
  await expect(page).toHaveURL(/\/kyc/);
  await fireInstallEvent(page);
  await page.waitForTimeout(500);
  await noPrompt(page);
});

test('AC6 not on /account-deletion (pending deletion screen)', async ({ page }) => {
  const m = await approved();
  const del = await call('POST', '/account/delete-request', { token: m.token, body: { password: m.password } });
  expect(del.status).toBeLessThan(300);
  await firstVisit(page, '/login');
  await fireInstallEvent(page);
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/account-deletion/);
  await expect(page.getByTestId('deleted-logout')).toBeVisible();
  await page.waitForTimeout(500);
  await noPrompt(page);
});

test('AC6 Install app calls the captured event once; appinstalled hides it and it never shows again (reload, other route)', async ({ page }) => {
  const m = await submitted();
  await firstVisit(page, '/login');
  await fireInstallEvent(page, 'accepted');
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/pending/);
  await expect(prompt(page)).toBeVisible();
  await page.getByTestId('install-button').click();
  await expect.poll(() => page.evaluate(() => (window as any).__installPromptCalls)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(prompt(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pwa_installed'))).toBe('1');
  await page.reload();
  await fireInstallEvent(page);
  await page.waitForTimeout(500);
  await noPrompt(page);
});

test('AC6 dismissal: a reload and a new event do not show it again; later renders do not either', async ({ page }) => {
  const m = await approved();
  await firstVisit(page, '/login');
  await fireInstallEvent(page, 'dismissed');
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/app/);
  await expect(prompt(page)).toBeVisible();
  await page.getByTestId('install-dismiss').click();
  await expect(prompt(page)).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pwa_install_dismissed:')))).toHaveLength(1);
  // a later render of AppPage (SPA navigation away and back) with the same captured event
  await page.getByRole('link', { name: 'Interests' }).click();
  await expect(page.getByRole('heading', { name: 'Interests', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app/);
  await fireInstallEvent(page);
  await page.waitForTimeout(500);
  await noPrompt(page);
  // reload, the browser fires the event again
  await page.reload();
  await fireInstallEvent(page);
  await expect(page.getByRole('link', { name: 'Interests' })).toBeVisible();
  await page.waitForTimeout(500);
  await noPrompt(page);
});

test('AC6 native "Not now" through the browser dialog (userChoice dismissed) is remembered too', async ({ page }) => {
  const m = await submitted();
  await firstVisit(page, '/login');
  await fireInstallEvent(page, 'dismissed');
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/pending/);
  await page.getByTestId('install-button').click();
  await expect(prompt(page)).toHaveCount(0);
  await page.reload();
  await fireInstallEvent(page);
  await expect(page.getByTestId('pending-state')).toBeVisible();
  await page.waitForTimeout(500);
  await noPrompt(page);
});

test('AC6 FINDING CHECK: before dismissing, a reload shows the prompt again, and so does re-rendering AppPage (the prompt is "consumed" only by dismiss/install)', async ({ page }) => {
  const m = await approved();
  await firstVisit(page, '/login');
  await fireInstallEvent(page);
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/app/);
  await expect(prompt(page)).toBeVisible(); // first render
  await page.getByRole('link', { name: 'Interests' }).click();
  await expect(page.getByRole('heading', { name: 'Interests', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(prompt(page)).toBeVisible(); // second render, not dismissed: shown again
  await page.reload();
  await fireInstallEvent(page);
  await expect(prompt(page)).toBeVisible(); // reload: shown again
});

test('AC6 dismissal is per member: another member on the same browser still gets the prompt once; the first member does not', async ({ page }) => {
  const a = await approved();
  const b = await approved();
  await firstVisit(page, '/login');
  await fireInstallEvent(page);
  await page.getByTestId('login-email').fill(a.email);
  await page.getByTestId('login-password').fill(a.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/app/);
  await page.getByTestId('install-dismiss').click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login|\/$/);
  await uiLogin(page, b);
  await fireInstallEvent(page);
  await expect(prompt(page)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login|\/$/);
  await uiLogin(page, a);
  await fireInstallEvent(page);
  await page.waitForTimeout(500);
  await noPrompt(page);
});

test.describe('iOS Safari (user agent emulation)', () => {
  test.use({ userAgent: IOS_UA });

  test('AC6 iOS: manual Add to Home Screen text on the PendingPage, none on login, no native button, dismissal remembered', async ({ page }) => {
    const m = await submitted();
    await firstVisit(page, '/login');
    await noPrompt(page);
    await page.getByTestId('login-email').fill(m.email);
    await page.getByTestId('login-password').fill(m.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/pending/);
    await expect(prompt(page)).toBeVisible();
    await expect(prompt(page)).toHaveAttribute('data-mode', 'ios-manual');
    await expect(page.getByTestId('install-ios-instruction')).toContainText('Add to Home Screen');
    await expect(page.getByTestId('install-button')).toHaveCount(0);
    await attachShot(page, 'ac6-install-ios-pending');
    await page.getByTestId('install-dismiss').click();
    await expect(prompt(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('pending-state')).toBeVisible();
    await page.waitForTimeout(500);
    await noPrompt(page);
  });

  test('AC6 iOS edge: not during onboarding either', async ({ page }) => {
    const m = await newMember();
    await uiLogin(page, m, /\/register/);
    await expect(page.getByTestId('wizard-dob')).toBeVisible();
    await page.waitForTimeout(500);
    await noPrompt(page);
  });
});

test('AC6 edge: a plain desktop Chromium UA with no captured event and no iOS shows no prompt at all', async ({ page }) => {
  const m = await submitted();
  await uiLogin(page, m, /\/pending/);
  await expect(page.getByTestId('pending-state')).toBeVisible();
  await page.waitForTimeout(500);
  await noPrompt(page);
});
