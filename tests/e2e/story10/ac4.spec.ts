/**
 * Phase 1 story 10, AC4: offline banner (role=status, English, hides within 2 s of reconnecting, does not cover the
 * primary navigation at 360 px). Real backend (3101), built app (5191), one approved member per test.
 */
import { expect, test, type Page } from '@playwright/test';
import { approved, attachShot, ctl, firstVisit, stubFonts, uiLogin } from './support10';

const OFFLINE_TEXT = 'You are offline. Some features may not work until you reconnect.';

test.beforeEach(async ({ context }) => {
  await ctl('reset');
  await stubFonts(context);
});

const banner = (page: Page) => page.getByRole('status').filter({ hasText: OFFLINE_TEXT });

test('AC4 going offline shows an English role=status banner; coming back hides it within 2 s', async ({ page, context }) => {
  const m = await approved();
  await firstVisit(page);
  await uiLogin(page, m);
  await expect(banner(page)).toHaveCount(0);
  await context.setOffline(true);
  await expect(banner(page)).toBeVisible();
  await expect(page.getByTestId('offline-banner')).toHaveAttribute('role', 'status');
  expect((await page.getByTestId('offline-banner').innerText()).trim()).toBe(OFFLINE_TEXT);
  await attachShot(page, 'ac4-offline-banner-360');
  const t0 = Date.now();
  await context.setOffline(false);
  await expect(page.getByTestId('offline-banner')).toHaveCount(0, { timeout: 2000 });
  test.info().annotations.push({ type: 'banner-hidden-after-ms', description: String(Date.now() - t0) });
  expect(Date.now() - t0).toBeLessThan(2000);
});

test('AC4 at 360 px the banner does not overlap or cover the header actions, and they stay clickable', async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const m = await approved();
  await firstVisit(page);
  await uiLogin(page, m);
  const actions = [
    page.getByRole('link', { name: 'Interests' }),
    page.getByRole('link', { name: 'Shortlists' }),
    page.getByRole('link', { name: 'Settings' }),
    page.getByRole('button', { name: 'Sign out' }),
  ];
  for (const a of actions) await expect(a).toBeVisible();
  const before = await Promise.all(actions.map((a) => a.boundingBox()));
  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  const b = (await page.getByTestId('offline-banner').boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(360);
  const rows: string[] = [];
  for (let i = 0; i < actions.length; i++) {
    const a = (await actions[i].boundingBox())!;
    rows.push(`${i}: action y=${a.y.toFixed(1)}..${(a.y + a.height).toFixed(1)}; banner y=${b.y.toFixed(1)}..${(b.y + b.height).toFixed(1)}`);
    const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(overlap, `action ${i} overlaps banner`).toBe(false);
    // not covered: the element at the centre of the action is the action itself
    const hit = await actions[i].evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top === el || el.contains(top);
    });
    expect(hit, `action ${i} covered`).toBe(true);
    // the banner pushes content down (normal flow), it does not float over it
    expect(a.y, `action ${i} moved with the banner`).toBeGreaterThanOrEqual(before[i]!.y);
  }
  test.info().annotations.push({ type: 'boxes', description: rows.join(' | ') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // still usable offline: client-side navigation to Settings works
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings/);
  await attachShot(page, 'ac4-offline-header-360');
});

test('AC4 edge: offline at first load of the login page shows the banner, and rapid offline/online toggling ends hidden', async ({ page, context }) => {
  await firstVisit(page, '/login');
  await context.setOffline(true);
  await expect(banner(page)).toBeVisible();
  await context.setOffline(false);
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.getByTestId('offline-banner')).toHaveCount(0, { timeout: 2000 });
});
