/**
 * Phase 1 story 10, AC5: update prompt with controlled skip-waiting.
 * "Second build" simulation: static-server.mjs serves /sw.js with a different build id after POST /__test/second-build, so the
 * browser sees a byte-different worker on registration.update() (this is exactly what a second deploy looks like to the browser).
 * Real backend (3101) for the member; the built app on 5191.
 */
import { expect, test, type Page } from '@playwright/test';
import { ctl, firstVisit, newMember, serverLog, stubFonts, typeWizardDraft, approved, uiLogin } from './support10';

test.beforeEach(async ({ context }) => {
  await ctl('reset');
  await stubFonts(context);
});

const NEW_CACHE = 'dhobi-shell-ffffffffffff';

async function deploySecondBuild(page: Page) {
  await ctl('second-build');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg!.update();
  });
}
const swState = (page: Page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { waiting: Boolean(reg?.waiting), installing: Boolean(reg?.installing), cacheNames: await caches.keys() };
  });

test('AC5 a second build shows the prompt, nothing reloads before the click, Update reloads exactly once and no loop follows', async ({ page }) => {
  let loads = 0;
  page.on('load', () => loads++);
  await firstVisit(page);
  const m = await approved();
  await uiLogin(page, m);
  await expect(page).toHaveURL(/\/app/);
  const loadsBefore = loads;
  await page.evaluate(() => ((window as any).__marker = 'same-document'));

  await deploySecondBuild(page);
  await expect(page.getByTestId('update-prompt')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Update available' })).toBeVisible();
  await expect(page.getByTestId('update-prompt')).toContainText('Update available');
  const during = await swState(page);
  expect(during.waiting, 'new worker waits').toBe(true);
  expect(during.cacheNames.sort()).toHaveLength(2); // old and new shell caches side by side while waiting

  await page.waitForTimeout(3000); // bounded negative check: nothing may reload on its own while the prompt is shown
  expect(loads).toBe(loadsBefore);
  expect(await page.evaluate(() => (window as any).__marker)).toBe('same-document');

  const navBefore = (await serverLog()).filter((p) => p === '/' || p === '/app').length;
  await page.getByTestId('update-button').click();
  await expect.poll(() => loads, { timeout: 10_000 }).toBe(loadsBefore + 1);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await expect(page.getByTestId('update-prompt')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__marker)).toBeUndefined();
  const after = await swState(page);
  expect(after.waiting).toBe(false);
  expect(after.cacheNames, 'old shell cache deleted, new one active').toEqual([NEW_CACHE]);
  const script = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.active!.scriptURL);
  expect(script).toMatch(/\/sw\.js$/);

  await page.waitForTimeout(3000); // bounded negative check: no reload loop
  expect(loads, 'exactly one reload after the click').toBe(loadsBefore + 1);
  const navAfter = (await serverLog()).filter((p) => p === '/' || p === '/app').length;
  test.info().annotations.push({ type: 'document-requests-before-after', description: `${navBefore} -> ${navAfter}` });
  expect(navAfter - navBefore).toBeLessThanOrEqual(1);
});

test('AC5 a dirty onboarding step form: Update shows the save-first hint and does not reload; after saving it applies', async ({ page }) => {
  let loads = 0;
  page.on('load', () => loads++);
  await firstVisit(page);
  const m = await newMember();
  await uiLogin(page, m, /\/register/);
  await typeWizardDraft(page, '1994-03-12'); // edited, not saved: the form is dirty
  await page.getByTestId('wizard-gender-male').click();
  await deploySecondBuild(page);
  await expect(page.getByTestId('update-prompt')).toBeVisible();
  const loadsBefore = loads;
  await page.evaluate(() => ((window as any).__marker = 'same-document'));

  await page.getByTestId('update-button').click();
  const hint = page.getByTestId('update-save-first-hint');
  await expect(hint).toBeVisible();
  expect((await hint.innerText()).trim()).toBe('Save your changes first, then update.');
  await expect(hint).toHaveAttribute('role', 'status');
  await page.waitForTimeout(2000); // bounded negative check: still no reload, worker still waiting
  expect(loads).toBe(loadsBefore);
  expect(await page.evaluate(() => (window as any).__marker)).toBe('same-document');
  expect((await swState(page)).waiting).toBe(true);
  await expect(page.getByTestId('wizard-dob')).toHaveValue('1994-03-12'); // the typed value is still there

  // saving makes the form clean; the same click now applies the update (one reload)
  await page.getByTestId('wizard-save').click();
  await expect(page.getByText(/Step 2 of 5/)).toBeVisible();
  await page.getByTestId('update-button').click();
  await expect.poll(() => loads, { timeout: 10_000 }).toBe(loadsBefore + 1);
  await page.waitForTimeout(2000);
  expect(loads).toBe(loadsBefore + 1);
});

test('AC5 edge: a double click on Update still reloads once; the first install of a worker never shows the prompt', async ({ page }) => {
  let loads = 0;
  page.on('load', () => loads++);
  await firstVisit(page);
  await expect(page.getByTestId('update-prompt')).toHaveCount(0);
  await deploySecondBuild(page);
  await expect(page.getByTestId('update-prompt')).toBeVisible();
  const loadsBefore = loads;
  await page.getByTestId('update-button').dblclick();
  await expect.poll(() => loads, { timeout: 10_000 }).toBe(loadsBefore + 1);
  await page.waitForTimeout(2500);
  expect(loads).toBe(loadsBefore + 1);
});
