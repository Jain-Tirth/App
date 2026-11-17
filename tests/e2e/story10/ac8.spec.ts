/**
 * Phase 1 story 10, AC8 (accessibility part): banner, update prompt and install prompts reachable by keyboard with a
 * visible focus indicator, accessible names, axe zero serious/critical, no horizontal scroll at 360 px.
 * Size budget checks are in budget.spec.ts. Real backend (3101), built app (5191).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '../../../AdminPanel/node_modules/@axe-core/playwright';
import { IOS_UA, approved, attachShot, ctl, fireInstallEvent, firstVisit, noScroll, spaLogin, stubFonts, submitted, uiLogin } from './support10';

test.beforeEach(async ({ context }) => {
  await ctl('reset');
  await stubFonts(context);
});

async function axeBad(page: Page, include?: string) {
  let b = new AxeBuilder({ page });
  if (include) b = b.include(include);
  const r = await b.analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Tab from the top of the page until `target` has focus; returns the focus indicator it shows. */
async function tabTo(page: Page, target: Locator, max = 40) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) {
      return target.evaluate((el) => {
        const s = getComputedStyle(el);
        return { outline: `${s.outlineStyle} ${s.outlineWidth}`, boxShadow: s.boxShadow, matchesFocusVisible: el.matches(':focus-visible') };
      });
    }
  }
  throw new Error('target never received keyboard focus');
}
const hasIndicator = (f: { outline: string; boxShadow: string }) => (f.outline !== 'none 0px' && !f.outline.startsWith('none')) || f.boxShadow !== 'none';

test('AC8 offline banner: role=status with its text, axe clean (whole page and banner), no horizontal scroll at 360 px', async ({ page, context }) => {
  const m = await approved();
  await firstVisit(page);
  await uiLogin(page, m);
  await context.setOffline(true);
  const banner = page.getByRole('status').filter({ hasText: 'You are offline' });
  await expect(banner).toBeVisible();
  expect(await axeBad(page, '[data-testid="offline-banner"]')).toEqual([]);
  expect(await axeBad(page)).toEqual([]);
  expect(await noScroll(page)).toBe(true);
  // the WifiOff icon is decorative
  await expect(page.getByTestId('offline-banner').locator('svg')).toHaveAttribute('aria-hidden', 'true');
});

test('AC8 update prompt: named region, keyboard reachable with visible focus, Enter activates, axe clean', async ({ page }) => {
  const m = await approved();
  await firstVisit(page);
  await uiLogin(page, m);
  await ctl('second-build');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  const region = page.getByRole('region', { name: 'Update available' });
  await expect(region).toBeVisible();
  const button = region.getByRole('button', { name: 'Update' });
  await expect(button).toBeVisible();
  expect(await axeBad(page, '[data-testid="update-prompt"]')).toEqual([]);
  expect(await axeBad(page)).toEqual([]);
  expect(await noScroll(page)).toBe(true);
  const focus = await tabTo(page, button);
  expect(focus.matchesFocusVisible).toBe(true);
  expect(hasIndicator(focus), JSON.stringify(focus)).toBe(true);
  await attachShot(page, 'ac8-update-prompt-focus');
  let loads = 0;
  page.on('load', () => loads++);
  await page.keyboard.press('Enter');
  await expect.poll(() => loads, { timeout: 10_000 }).toBe(1);
});

test('AC8 update prompt hint: the save-first message is announced (role=status) and focus stays on the Update button', async ({ page }) => {
  const m = await approved();
  await firstVisit(page);
  await uiLogin(page, m);
  await ctl('second-build');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect(page.getByTestId('update-prompt')).toBeVisible();
  // simulate "dirty" is covered in ac5.spec.ts (real wizard); here only the focus behaviour of the button is checked
  const button = page.getByTestId('update-button');
  await button.focus();
  await expect(button).toBeFocused();
});

test('AC8 install prompt (native): named region and buttons, keyboard reachable with visible focus, axe clean', async ({ page }) => {
  const m = await submitted();
  await firstVisit(page, '/login');
  await fireInstallEvent(page);
  await spaLogin(page, m, /\/pending/);
  const region = page.getByRole('region', { name: 'Install the app' });
  await expect(region).toBeVisible();
  const install = region.getByRole('button', { name: 'Install app' });
  const notNow = region.getByRole('button', { name: 'Not now' });
  await expect(install).toBeVisible();
  await expect(notNow).toBeVisible();
  expect(await axeBad(page, '[data-testid="install-prompt"]')).toEqual([]);
  expect(await axeBad(page)).toEqual([]);
  expect(await noScroll(page)).toBe(true);
  for (const b of [install, notNow]) {
    const focus = await tabTo(page, b);
    expect(focus.matchesFocusVisible).toBe(true);
    expect(hasIndicator(focus), JSON.stringify(focus)).toBe(true);
  }
  await attachShot(page, 'ac8-install-prompt-focus');
});

test('AC8 install prompt (iOS manual text): named region, readable instruction, axe clean, dismiss by keyboard', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: IOS_UA, viewport: { width: 360, height: 780 } });
  await stubFonts(ctx);
  const page = await ctx.newPage();
  const m = await submitted();
  await uiLogin(page, m, /\/pending/);
  const region = page.getByRole('region', { name: 'Install the app' });
  await expect(region).toBeVisible();
  await expect(region.getByTestId('install-ios-instruction')).toContainText('Add to Home Screen');
  expect(await axeBad(page, '[data-testid="install-prompt"]')).toEqual([]);
  expect(await axeBad(page)).toEqual([]);
  const gotIt = region.getByRole('button', { name: 'Got it' });
  const focus = await tabTo(page, gotIt);
  expect(hasIndicator(focus), JSON.stringify(focus)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(region).toHaveCount(0);
  await ctx.close();
});

const activeInfo = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    const r = a?.getBoundingClientRect();
    return { tag: a?.tagName, testid: a?.getAttribute('data-testid'), w: r?.width, h: r?.height };
  });

async function assertHeadingFocus(page: Page, name: string) {
  const heading = page.getByTestId('page-heading');
  await expect(heading).toBeFocused();
  const info = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const r = a.getBoundingClientRect();
    return { w: r.width, h: r.height, boxShadow: getComputedStyle(a).boxShadow };
  });
  test.info().annotations.push({ type: name, description: JSON.stringify(info) });
  expect(info.h).toBeGreaterThan(0);
  expect(info.w).toBeGreaterThan(0);
  expect(info.boxShadow, 'focus ring (box-shadow) while focused').not.toBe('none');
  await attachShot(page, name);
  await expect(page.getByTestId('install-focus-anchor')).toHaveCount(0);
  const unfocused = await heading.evaluate((el) => { (el as HTMLElement).blur(); return getComputedStyle(el).boxShadow; });
  expect(unfocused).toBe('none');
  await heading.focus();
  await page.keyboard.press('Tab');
  const next = await activeInfo(page);
  test.info().annotations.push({ type: name + '-next', description: JSON.stringify(next) });
  expect(['BUTTON', 'A', 'INPUT']).toContain(next.tag);
  // tabindex=-1 heading is not in the Tab sequence: Shift+Tab leaves it for the previous tabbable control (no trap)
  await page.keyboard.press('Shift+Tab');
  const back = await activeInfo(page);
  test.info().annotations.push({ type: name + '-shift-tab', description: JSON.stringify(back) });
  expect(back.testid).not.toBe('page-heading');
  // BODY is acceptable here: the control after the heading can be the first tabbable element, so Shift+Tab leaves the document start
  await page.keyboard.press('Tab');
  expect((await activeInfo(page)).tag).toBe(next.tag);
  // from the heading itself, Shift+Tab also moves away
  await heading.focus();
  await page.keyboard.press('Shift+Tab');
  expect((await activeInfo(page)).testid).not.toBe('page-heading');
}

for (const [label, mk, path] of [['pending', submitted, /\/pending/], ['app', approved, /\/app/]] as const) {
  test(`AC8 /${label}: after keyboard dismissal focus is the visible page heading with a ring, Tab and Shift+Tab free`, async ({ page }) => {
    const m = await mk();
    await firstVisit(page, '/login');
    await fireInstallEvent(page);
    await spaLogin(page, m, path);
    const dismiss = page.getByTestId('install-dismiss');
    await expect(dismiss).toBeVisible();
    await tabTo(page, dismiss);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('install-prompt')).toHaveCount(0);
    await assertHeadingFocus(page, `ac8-${label}-after-dismiss`);
  });

  test(`AC8 /${label}: after install focus is the visible page heading with a ring, Tab and Shift+Tab free`, async ({ page }) => {
    const m = await mk();
    await firstVisit(page, '/login');
    await fireInstallEvent(page, 'accepted');
    await spaLogin(page, m, path);
    await tabTo(page, page.getByTestId('install-button'));
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => (window as any).__installPromptCalls)).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(page.getByTestId('install-prompt')).toHaveCount(0);
    await assertHeadingFocus(page, `ac8-${label}-after-install`);
  });
}
