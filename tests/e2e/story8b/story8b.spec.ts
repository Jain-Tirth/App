/**
 * Phase 1 story 8b: member UI for named shortlists (drawer, create, add to several lists, /shortlists page, rename,
 * delete, remove, empty states, friendly errors, 360 px, keyboard, axe).
 * Harness: real backend (dist/main.js, port 3101, test DB, fake storage) + UserWeb dev (5190). Viewport 360 x 780.
 * Seeding: an approved member through the real endpoints (memberAt, story 5b); approved target profiles inserted into
 * the test DB with support6b seedProfile in a unique city tag so `/app?city=<tag>` shows exactly them.
 *
 * MOCKED / BYPASSING cases (everything else is a real server answer):
 *  - AC1 loading state: page.route holds the real GET /shortlists/:id/profiles request and then continues it (delay only).
 *  - AC2 in-flight: page.route holds the real PUT and continues it (delay only).
 *  - AC2 revert on failure: page.route FULFILLS a synthetic 500 (mocked) for one PUT; no real server error is available.
 *  - AC3 server VALIDATION_ERROR on name: page.route rewrites the body of the real POST /shortlists to '' or 101 chars and
 *    forwards it (bypass: the client check would stop it); the server answers 400 with details.issues.
 *  - AC8/AC10 DEFAULT_SHORTLIST_PROTECTED: page.route rewrites the URL of the real DELETE / PATCH from a non-default
 *    list to the default list id and forwards it (bypass: the UI has no such control).
 *  - AC8/AC10 SHORTLIST_NOT_FOUND and AC10 SHORTLIST_NAME_TAKEN: no route; state arranged through real endpoints in
 *    another session (list deleted by API) and a duplicate name typed in the UI.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '../../../AdminPanel/node_modules/@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  FRIENDLY_BAD, MSG, USER, apiAdd, apiCreate, apiDeleteList, apiLists, apiMembers, call, hideFor, noHorizontalScroll,
  seedProfile, signIn, tag, viewer, withinWidth,
} from './support8b';

const ART = path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-8b');
mkdirSync(ART, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${ART}/${name}.png`, fullPage: true });

const drawer = (page: Page) => page.getByRole('dialog', { name: 'Save to shortlist' });
const cards = (page: Page) => page.getByTestId('results-list').getByTestId('profile-card');

async function boot(first = 'Tara') {
  const v = await viewer();
  const city = tag();
  const t = await seedProfile({ first, city });
  return { v, city, t };
}

async function openCards(page: Page, city: string) {
  await page.goto(`/app?city=${city}`);
  await expect(cards(page)).toHaveCount(1);
}

async function openDrawer(page: Page) {
  await cards(page).getByTestId('shortlist-button').click();
  await expect(drawer(page)).toBeVisible();
  await expect(page.getByTestId('shortlist-drawer-loading')).toHaveCount(0);
}

async function openLists(page: Page) {
  await page.goto('/shortlists');
  await expect(page.getByRole('heading', { name: 'Shortlists', level: 1 })).toBeVisible();
  await expect(page.getByTestId('shortlists-loading')).toHaveCount(0);
}

const selectList = (page: Page, name: string) => page.getByTestId('shortlists-lists').getByRole('button', { name, exact: true });

async function pick(page: Page, name: string) {
  await selectList(page, name).click();
  await expect(page.getByRole('heading', { name, level: 2, exact: true })).toBeVisible();
  await expect(page.getByTestId('shortlist-cards-loading')).toHaveCount(0);
}

function track(page: Page) {
  const log: { method: string; path: string; body: string | null }[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.includes('/shortlists')) log.push({ method: r.method(), path: u.pathname + u.search, body: r.postData() });
  });
  return log;
}

async function friendlyText(loc: Locator, expected: string) {
  await expect(loc).toBeVisible();
  const text = (await loc.innerText()).trim();
  for (const re of FRIENDLY_BAD) expect(text, `must not match ${re}`).not.toMatch(re);
  expect(text).toBe(expected);
}

async function serious(page: Page, include?: string) {
  const b = new AxeBuilder({ page });
  if (include) b.include(include);
  const r = await b.analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}:${v.impact}:${v.nodes.length}:${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function createViaDrawer(page: Page, name: string) {
  await page.getByLabel('Create new list').fill(name);
  await page.getByTestId('shortlist-create-submit').click();
}

// ------------------------------------------------------------------ AC1
test.describe('AC1 drawer', () => {
  test('AC1 title, one checkbox per list named after it, create field, not-notified, focus in and back, Escape, close button', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    await apiCreate(v, 'Family picks');
    await signIn(page, v);
    await openCards(page, city);
    const btn = cards(page).getByTestId('shortlist-button');
    await expect(btn).toHaveAccessibleName('Shortlist');
    await btn.click();
    const d = drawer(page);
    await expect(d).toBeVisible();
    await expect(d.getByRole('heading', { name: 'Save to shortlist' })).toBeVisible();
    await expect(d.getByRole('checkbox')).toHaveCount(2);
    await expect(d.getByRole('checkbox', { name: 'Shortlisted' })).toBeVisible();
    await expect(d.getByRole('checkbox', { name: 'Family picks' })).toBeVisible();
    await expect(d.getByLabel('Create new list')).toBeVisible();
    await expect(d.getByText(MSG.notNotified)).toBeVisible();
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[data-testid="shortlist-drawer"]'));
    expect(inside).toBe(true);
    await shot(page, 'ac1-drawer');
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
    await expect(btn).toBeFocused();
    await btn.click();
    await expect(d).toBeVisible();
    await d.getByRole('button', { name: 'Close' }).click();
    await expect(d).toHaveCount(0);
    await expect(btn).toBeFocused();
  });

  test('AC1 loading state while membership is derived; no enabled checkbox until it is done', async ({ page }) => {
    const { v, city } = await boot();
    const [def] = await apiLists(v);
    await signIn(page, v);
    await openCards(page, city);
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    let heldCount = 0;
    await page.route(`**/shortlists/${def.id}/profiles*`, async (route) => {
      heldCount++;
      await held;
      await route.continue();
    });
    await cards(page).getByTestId('shortlist-button').click();
    await expect(page.getByTestId('shortlist-drawer-loading')).toHaveText('Loading your lists...');
    await expect(page.getByRole('checkbox', { disabled: false })).toHaveCount(0);
    await shot(page, 'ac1-loading');
    release();
    await expect(page.getByTestId('shortlist-drawer-loading')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Shortlisted' })).toBeEnabled();
    expect(heldCount).toBeGreaterThan(0);
  });

  test('AC1 membership derived from list contents, walked by cursor (profile on 2nd page of 50)', async ({ page }) => {
    const { v, city, t } = await boot();
    const [def] = await apiLists(v);
    const log = track(page);
    // 55 profiles in the list; the target is added last so it sits on the second page of the 50-wide walk
    const filler = [];
    for (let i = 0; i < 54; i++) filler.push(await seedProfile({ first: `Fil${i}`, city: `${city}f` }));
    for (const f of filler) await apiAdd(v, def.id, f.profileRef);
    await apiAdd(v, def.id, t.profileRef);
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    await expect(drawer(page).getByRole('checkbox', { name: 'Shortlisted' })).toBeChecked();
    const gets = log.filter((e) => e.method === 'GET' && e.path.includes(`/shortlists/${def.id}/profiles`));
    expect(gets.length).toBeGreaterThanOrEqual(2);
    expect(gets.some((g) => g.path.includes('cursor='))).toBe(true);
  });

  test('AC1 detail page also has the Shortlist button', async ({ page }) => {
    const { v, t } = await boot();
    await signIn(page, v);
    await page.goto(`/profile/${t.profileRef}`);
    const btn = page.getByTestId('profile-detail').getByTestId('shortlist-button');
    await btn.click();
    await expect(drawer(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(btn).toBeFocused();
  });
});

// ------------------------------------------------------------------ AC2
test.describe('AC2 add to several lists', () => {
  test('AC2 tick two lists (one PUT each), reopen both ticked, reload both ticked, untick one (one DELETE), verified in list views', async ({ page }) => {
    const { v, city, t } = await boot();
    const [def] = await apiLists(v);
    const fam = await apiCreate(v, 'Family');
    await signIn(page, v);
    const log = track(page);
    await openCards(page, city);
    await openDrawer(page);
    const d = drawer(page);
    // the checkbox flips only after the server confirms (not optimistic), so click then assert instead of .check()
    await d.getByRole('checkbox', { name: 'Shortlisted' }).click();
    await expect(d.getByRole('checkbox', { name: 'Shortlisted' })).toBeChecked();
    await d.getByRole('checkbox', { name: 'Family' }).click();
    await expect(d.getByRole('checkbox', { name: 'Family' })).toBeChecked();
    const puts = log.filter((e) => e.method === 'PUT');
    expect(puts.map((p) => p.path).sort()).toEqual([
      `/api/v1/shortlists/${def.id}/profiles/${t.profileRef}`,
      `/api/v1/shortlists/${fam.id}/profiles/${t.profileRef}`,
    ].sort());
    expect(log.filter((e) => e.method === 'DELETE')).toHaveLength(0);
    // Close button, not Escape: after a tick the focused checkbox is disabled during the request and focus drops to body
    // (see the separate AC13 test for the Escape consequence)
    await d.getByRole('button', { name: 'Close' }).click();
    await openDrawer(page);
    await expect(d.getByRole('checkbox', { name: 'Shortlisted' })).toBeChecked();
    await expect(d.getByRole('checkbox', { name: 'Family' })).toBeChecked();
    await d.getByRole('button', { name: 'Close' }).click();
    // fresh page load: derived from the server again
    await openCards(page, city);
    await openDrawer(page);
    await expect(d.getByRole('checkbox', { name: 'Shortlisted' })).toBeChecked();
    await expect(d.getByRole('checkbox', { name: 'Family' })).toBeChecked();
    const before = log.length;
    await d.getByRole('checkbox', { name: 'Family' }).click();
    await expect(d.getByRole('checkbox', { name: 'Family' })).not.toBeChecked();
    const after = log.slice(before).filter((e) => !(e.method === 'GET'));
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ method: 'DELETE', path: `/api/v1/shortlists/${fam.id}/profiles/${t.profileRef}` });
    await expect(d.getByRole('checkbox', { name: 'Shortlisted' })).toBeChecked();
    expect(await apiMembers(v, def.id)).toEqual([t.profileRef]);
    expect(await apiMembers(v, fam.id)).toEqual([]);
    await d.getByRole('button', { name: 'Close' }).click();
    await openLists(page);
    await expect(page.getByTestId('shortlist-cards').getByTestId('profile-card')).toHaveCount(1);
    await pick(page, 'Family');
    await expect(page.getByTestId('shortlist-empty')).toBeVisible();
    await shot(page, 'ac2-family-empty');
  });

  test('AC2 checkbox is disabled while its own request is in flight; other list stays enabled', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    await apiCreate(v, 'Second');
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    let puts = 0;
    await page.route('**/shortlists/*/profiles/*', async (route) => {
      if (route.request().method() === 'PUT') { puts++; await held; }
      await route.continue();
    });
    const first = drawer(page).getByRole('checkbox', { name: 'Shortlisted' });
    await first.click();
    await expect(first).toBeDisabled();
    await expect(drawer(page).getByRole('checkbox', { name: 'Second' })).toBeEnabled();
    release();
    await expect(first).toBeEnabled();
    await expect(first).toBeChecked();
    expect(puts).toBe(1);
  });

  test('AC2 failure reverts the checkbox and shows a friendly sentence (MOCKED synthetic 500)', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    await page.route('**/shortlists/*/profiles/*', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'boom', requestId: 'r-1' }) })
        : route.continue());
    const cb = drawer(page).getByRole('checkbox', { name: 'Shortlisted' });
    await cb.click();
    await expect(page.getByTestId('shortlist-drawer-error-text')).toBeVisible();
    const text = await page.getByTestId('shortlist-drawer-error-text').innerText();
    for (const re of FRIENDLY_BAD) expect(text).not.toMatch(re);
    expect(text).not.toMatch(/boom|r-1/);
    await expect(cb).not.toBeChecked();
    await expect(cb).toBeEnabled();
  });
});

// ------------------------------------------------------------------ AC3
test.describe('AC3 create list', () => {
  test('AC3 empty and whitespace-only: required sentence, no request', async ({ page }) => {
    const { v, city } = await boot();
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    const log = track(page);
    await createViaDrawer(page, '   ');
    await expect(page.getByTestId('field-error-shortlist-create-name')).toHaveText(MSG.required);
    await page.getByLabel('Create new list').fill('');
    await page.getByTestId('shortlist-create-submit').click();
    await expect(page.getByTestId('field-error-shortlist-create-name')).toHaveText(MSG.required);
    expect(log.filter((e) => e.method === 'POST')).toHaveLength(0);
  });

  test('AC3 101 characters: too-long sentence before any request; 100 accepted; counter counts trimmed length', async ({ page }) => {
    const { v, city } = await boot();
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    const log = track(page);
    const field = page.getByLabel('Create new list');
    await field.fill('  abc  ');
    await expect(page.getByTestId('shortlist-create-name-counter')).toHaveText('3 / 100 characters');
    await field.fill('x'.repeat(101));
    await expect(page.getByTestId('shortlist-create-name-counter')).toHaveText('101 / 100 characters');
    await page.getByTestId('shortlist-create-submit').click();
    await expect(page.getByTestId('field-error-shortlist-create-name')).toHaveText(MSG.tooLong);
    expect(log.filter((e) => e.method === 'POST')).toHaveLength(0);
    await field.fill('y'.repeat(100));
    await page.getByTestId('shortlist-create-submit').click();
    await expect(drawer(page).getByRole('checkbox')).toHaveCount(2);
    expect(log.filter((e) => e.method === 'POST')).toHaveLength(1);
  });

  test('AC3 trimmed name sent; created list appears in the drawer (unticked) and on /shortlists', async ({ page }) => {
    const { v, city } = await boot();
    await signIn(page, v);
    const log = track(page);
    await openCards(page, city);
    await openDrawer(page);
    await createViaDrawer(page, '  Pune  ');
    const cb = drawer(page).getByRole('checkbox', { name: 'Pune', exact: true });
    await expect(cb).toBeVisible();
    await expect(cb).not.toBeChecked();
    await expect(page.getByLabel('Create new list')).toHaveValue('');
    const post = log.find((e) => e.method === 'POST')!;
    expect(JSON.parse(post.body!)).toEqual({ name: 'Pune' });
    await page.getByRole('link', { name: 'View all your lists' }).click();
    await expect(page).toHaveURL(/\/shortlists$/);
    await expect(selectList(page, 'Pune')).toBeVisible();
  });

  test('AC3 duplicate (case-insensitive) shows the sentence next to the field and keeps the typed value', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    await apiCreate(v, 'Pune');
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    await createViaDrawer(page, 'pUNE');
    await friendlyText(page.getByTestId('field-error-shortlist-create-name'), MSG.taken);
    await expect(page.getByLabel('Create new list')).toHaveValue('pUNE');
    await expect(drawer(page).getByRole('checkbox')).toHaveCount(2);
    await shot(page, 'ac3-duplicate');
  });

  test('AC3 server VALIDATION_ERROR on name (details.issues) shows the same sentences (BYPASS via page.route body rewrite)', async ({ page }) => {
    const { v, city } = await boot();
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    let rewrite = '';
    const statuses: number[] = [];
    await page.route('**/shortlists', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.continue({ postData: JSON.stringify({ name: rewrite }) });
    });
    page.on('response', (r) => { if (r.request().method() === 'POST' && r.url().endsWith('/shortlists')) statuses.push(r.status()); });
    rewrite = '';
    await createViaDrawer(page, 'placeholder');
    await expect(page.getByTestId('field-error-shortlist-create-name')).toHaveText(MSG.required);
    rewrite = 'z'.repeat(101);
    await createViaDrawer(page, 'placeholder2');
    await expect(page.getByTestId('field-error-shortlist-create-name')).toHaveText(MSG.tooLong);
    expect(statuses).toEqual([400, 400]);
    await expect(page.getByTestId('shortlist-drawer-error')).toHaveCount(0);
  });

  test('AC3 creating 25 lists works in the UI (drawer and page show all 26)', async ({ page }) => {
    const { v, city } = await boot();
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    for (let i = 1; i <= 25; i++) {
      await createViaDrawer(page, `List ${String(i).padStart(2, '0')}`);
      await expect(drawer(page).getByRole('checkbox')).toHaveCount(i + 1);
    }
    expect((await apiLists(v)).length).toBe(26);
    await page.getByRole('link', { name: 'View all your lists' }).click();
    await expect(page.getByTestId('shortlists-lists').getByRole('button')).toHaveCount(26);
  });
});

// ------------------------------------------------------------------ AC4
test.describe('AC4 rename and default protection', () => {
  test('AC4 default list: Default list label, no Rename and no Delete control anywhere', async ({ page }) => {
    const { v } = await boot();
    await apiLists(v);
    await apiCreate(v, 'Other');
    await signIn(page, v);
    await openLists(page);
    await expect(page.getByRole('heading', { name: 'Shortlisted', level: 2 })).toBeVisible();
    await expect(page.getByTestId('default-list-label')).toHaveText('Default list');
    await expect(page.getByTestId('rename-list')).toHaveCount(0);
    await expect(page.getByTestId('delete-list')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /rename/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
    await pick(page, 'Other');
    await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete list' })).toBeVisible();
    await expect(page.getByTestId('default-list-label')).toHaveCount(0);
    await pick(page, 'Shortlisted');
    await expect(page.getByRole('button', { name: /rename|delete/i })).toHaveCount(0);
  });

  test('AC4 rename: same name rules, duplicate sentence, success updates heading and chip; names are plain text', async ({ page }) => {
    const { v } = await boot();
    await apiLists(v);
    await apiCreate(v, 'Alpha');
    await apiCreate(v, 'Beta');
    await signIn(page, v);
    const log = track(page);
    await openLists(page);
    await pick(page, 'Alpha');
    await page.getByRole('button', { name: 'Rename' }).click();
    const dlg = page.getByRole('dialog', { name: 'Rename list' });
    await expect(dlg).toBeVisible();
    const field = dlg.getByLabel('List name');
    await expect(field).toHaveValue('Alpha');
    await field.fill('   ');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByTestId('field-error-shortlist-rename-name')).toHaveText(MSG.required);
    await field.fill('q'.repeat(101));
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByTestId('field-error-shortlist-rename-name')).toHaveText(MSG.tooLong);
    expect(log.filter((e) => e.method === 'PATCH')).toHaveLength(0);
    await field.fill('BETA');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await friendlyText(dlg.getByTestId('field-error-shortlist-rename-name'), MSG.taken);
    await expect(field).toHaveValue('BETA');
    await field.fill('  <b>Bold</b> & <i>it</i>  ');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg).toHaveCount(0);
    const patch = log.find((e) => e.method === 'PATCH')!;
    expect(patch).toBeTruthy();
    await expect(page.getByRole('heading', { name: '<b>Bold</b> & <i>it</i>', level: 2 })).toBeVisible();
    expect(await page.locator('main b, main i').count()).toBe(0);
    await expect(selectList(page, '<b>Bold</b> & <i>it</i>')).toBeVisible();
    expect((await apiLists(v)).map((l) => l.name)).toContain('<b>Bold</b> & <i>it</i>');
  });
});

// ------------------------------------------------------------------ AC5
test.describe('AC5 delete', () => {
  test('AC5 confirmation text and buttons; Cancel and Escape send nothing; confirm removes list, focus on next list, profile stays elsewhere', async ({ page }) => {
    const { v, t } = await boot();
    const [def] = await apiLists(v);
    await apiCreate(v, 'A list');
    const b = await apiCreate(v, 'B list');
    const c = await apiCreate(v, 'C list');
    await apiAdd(v, def.id, t.profileRef);
    await apiAdd(v, b.id, t.profileRef);
    await apiAdd(v, c.id, t.profileRef);
    await signIn(page, v);
    const log = track(page);
    await openLists(page);
    await pick(page, 'B list');
    await expect(page.getByTestId('shortlist-cards').getByTestId('profile-card')).toHaveCount(1);
    const del = page.getByRole('button', { name: 'Delete list' });
    await del.click();
    const dlg = page.getByRole('dialog', { name: 'Delete the list B list? The profiles stay in your other lists.' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Keep list' })).toBeFocused();
    await shot(page, 'ac5-confirm');
    await dlg.getByRole('button', { name: 'Keep list' }).click();
    await expect(dlg).toHaveCount(0);
    await expect(del).toBeFocused();
    await del.click();
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(del).toBeFocused();
    expect(log.filter((e) => e.method === 'DELETE')).toHaveLength(0);
    expect(await apiLists(v)).toHaveLength(4);
    await del.click();
    await dlg.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(dlg).toHaveCount(0);
    expect(log.filter((e) => e.method === 'DELETE').map((e) => e.path)).toEqual([`/api/v1/shortlists/${b.id}`]);
    await expect(selectList(page, 'B list')).toHaveCount(0);
    await expect(selectList(page, 'C list')).toBeFocused();
    await expect(page.getByRole('heading', { name: 'C list', level: 2 })).toBeVisible();
    // the profile is still in the other lists
    await expect(page.getByTestId('shortlist-cards').getByTestId('profile-card')).toHaveCount(1);
    await pick(page, 'Shortlisted');
    await expect(page.getByTestId('shortlist-cards').getByTestId('profile-card')).toHaveCount(1);
    expect(await apiMembers(v, def.id)).toEqual([t.profileRef]);
    // and the drawer no longer lists B
    await page.goto(`/app?city=${await cityOf(t.userId)}`);
    await expect(cards(page)).toHaveCount(1);
    await openDrawer(page);
    await expect(drawer(page).getByRole('checkbox', { name: 'B list' })).toHaveCount(0);
    await expect(drawer(page).getByRole('checkbox', { name: 'C list' })).toBeChecked();
    await expect(drawer(page).getByRole('checkbox', { name: 'Shortlisted' })).toBeChecked();
  });
});

import { db } from '../userweb/support';
async function cityOf(userId: string): Promise<string> {
  return db(async (c) => (await c.query(
    `select l.city from "ProfileLocations" l join "Profiles" p on p.id=l."profileId" where p."userId"=$1`, [userId])).rows[0].city);
}

// ------------------------------------------------------------------ AC6
test.describe('AC6 list view', () => {
  test('AC6 20 at a time with Load more, Remove accessible name, one DELETE per click, hidden profile absent without error, no contact fields, cards link to detail', async ({ page }) => {
    const v = await viewer();
    const [def] = await apiLists(v);
    const list = await apiCreate(v, 'Big list');
    const seeds = [];
    for (let i = 0; i < 25; i++) seeds.push(await seedProfile({ first: `Devi${String(i).padStart(2, '0')}`, city: tag() }));
    for (const s of seeds) await apiAdd(v, list.id, s.profileRef);
    const hidden = await seedProfile({ first: 'Hidya', city: tag() });
    await apiAdd(v, list.id, hidden.profileRef);
    await hideFor(v, hidden.userId);
    expect((await apiLists(v)).find((l) => l.id === list.id)!.profileCount).toBe(26); // raw count includes hidden
    await apiAdd(v, def.id, seeds[0].profileRef);
    await signIn(page, v);
    const log = track(page);
    await openLists(page);
    await pick(page, 'Big list');
    const grid = page.getByTestId('shortlist-cards').getByTestId('profile-card');
    await expect(grid).toHaveCount(20);
    await expect(page.getByTestId('shortlist-cards-error')).toHaveCount(0);
    const first = log.filter((e) => e.method === 'GET' && e.path.includes(`/shortlists/${list.id}/profiles`));
    expect(first[0].path).toContain('limit=20');
    expect(first[0].path).not.toContain('cursor=');
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(grid).toHaveCount(25);
    await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
    await expect(page.getByText('Hidya')).toHaveCount(0);
    await expect(page.getByTestId('shortlist-cards-error')).toHaveCount(0);
    await expect(page.getByTestId('shortlists-error')).toHaveCount(0);
    const gets = log.filter((e) => e.method === 'GET' && e.path.includes(`/shortlists/${list.id}/profiles`));
    expect(gets).toHaveLength(2);
    expect(gets[1].path).toContain('cursor=');
    // no contact fields
    const text = await page.getByTestId('shortlist-cards').innerText();
    expect(text).not.toMatch(/@|\b\d{10}\b|mobile|phone|email/i);
    for (const s of seeds.slice(0, 3)) {
      expect(text).not.toContain(s.email);
      expect(text).not.toContain(s.mobile);
    }
    // cards link to the detail page
    const href = await grid.first().getByRole('link').first().getAttribute('href');
    expect(href).toMatch(/^\/profile\/[0-9a-f]{32}$/);
    // Remove
    const rm = page.getByRole('button', { name: `Remove Devi03 from Big list` });
    await expect(rm).toBeVisible();
    await expect(rm).toHaveText('Remove');
    const before = log.length;
    await rm.click();
    await expect(grid).toHaveCount(24);
    await expect(rm).toHaveCount(0);
    const after = log.slice(before).filter((e) => e.method !== 'GET');
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ method: 'DELETE', path: `/api/v1/shortlists/${list.id}/profiles/${seeds[3].profileRef}` });
    expect((await apiMembers(v, list.id)).includes(seeds[3].profileRef)).toBe(false);
    // other list untouched
    await pick(page, 'Shortlisted');
    await expect(grid).toHaveCount(1);
    await shot(page, 'ac6-list');
  });

  test('AC6 profile that stops being approved is simply absent, no error', async ({ page }) => {
    const v = await viewer();
    const [def] = await apiLists(v);
    const a = await seedProfile({ first: 'Keepa', city: tag() });
    const b = await seedProfile({ first: 'Gonea', city: tag() });
    await apiAdd(v, def.id, a.profileRef);
    await apiAdd(v, def.id, b.profileRef);
    await db((c) => c.query(`update "Users" set "profileReviewStatus"='submitted' where id=$1`, [b.userId]));
    await signIn(page, v);
    await openLists(page);
    await expect(page.getByTestId('shortlist-cards').getByTestId('profile-card')).toHaveCount(1);
    await expect(page.getByText('Keepa')).toBeVisible();
    await expect(page.getByText('Gonea')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ AC7
test.describe('AC7 empty states and reassurance', () => {
  test('AC7 first visit creates the default list; empty sentence, search link, not-notified on page and drawer', async ({ page }) => {
    const { v, city } = await boot();
    await signIn(page, v);
    await openLists(page);
    await expect(page.getByRole('heading', { name: 'Shortlisted', level: 2 })).toBeVisible();
    await expect(page.getByTestId('shortlist-empty')).toContainText(MSG.empty);
    const link = page.getByTestId('shortlist-empty').getByRole('link', { name: 'Find profiles' });
    await expect(link).toHaveAttribute('href', '/app');
    await expect(page.getByTestId('shortlist-not-notified')).toHaveText(MSG.notNotified);
    await expect(page.getByText(/no lists/i)).toHaveCount(0);
    expect((await apiLists(v)).map((l) => l.name)).toEqual(['Shortlisted']);
    await link.click();
    await expect(page).toHaveURL(/\/app$/);
    await openCards(page, city);
    await openDrawer(page);
    await expect(page.getByTestId('shortlist-not-notified')).toHaveText(MSG.notNotified);
    await shot(page, 'ac7-empty');
  });
});

// ------------------------------------------------------------------ AC8 + AC10
test.describe('AC8 and AC10 protected and missing lists, friendly server errors', () => {
  test('AC8/AC10 SHORTLIST_NAME_TAKEN through the UI (no route; real server answer is not reachable because the client allows it? see note)', async ({ page }) => {
    // The client does NOT check duplicates, so the real server answers; no route used.
    const { v, city } = await boot();
    await apiLists(v);
    await apiCreate(v, 'Taken');
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    const statuses: number[] = [];
    page.on('response', (r) => { if (r.request().method() === 'POST' && r.url().endsWith('/shortlists')) statuses.push(r.status()); });
    await createViaDrawer(page, 'taken');
    await friendlyText(page.getByTestId('field-error-shortlist-create-name'), MSG.taken);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toBe(409);
  });

  test('AC8/AC10 DEFAULT_SHORTLIST_PROTECTED: crafted DELETE of the default list forwarded with page.route; list stays', async ({ page }) => {
    const { v } = await boot();
    const [def] = await apiLists(v);
    const tmp = await apiCreate(v, 'Temp');
    await signIn(page, v);
    await openLists(page);
    await pick(page, 'Temp');
    const statuses: number[] = [];
    await page.route(`**/shortlists/${tmp.id}`, (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      const url = route.request().url().replace(tmp.id, def.id);
      return route.continue({ url });
    });
    page.on('response', (r) => { if (r.request().method() === 'DELETE') statuses.push(r.status()); });
    await page.getByRole('button', { name: 'Delete list' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await friendlyText(page.getByTestId('confirm-error-text'), MSG.protectedList);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toBeGreaterThanOrEqual(400);
    await shot(page, 'ac8-protected-delete');
    await page.keyboard.press('Escape');
    await expect(selectList(page, 'Temp')).toBeVisible();
    await expect(selectList(page, 'Shortlisted')).toBeVisible();
    expect((await apiLists(v)).map((l) => l.name).sort()).toEqual(['Shortlisted', 'Temp']);
  });

  test('AC8 DEFAULT_SHORTLIST_PROTECTED: crafted PATCH rename of the default list forwarded with page.route', async ({ page }) => {
    const { v } = await boot();
    const [def] = await apiLists(v);
    const tmp = await apiCreate(v, 'Temp2');
    await signIn(page, v);
    await openLists(page);
    await pick(page, 'Temp2');
    await page.route(`**/shortlists/${tmp.id}`, (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      return route.continue({ url: route.request().url().replace(tmp.id, def.id) });
    });
    await page.getByRole('button', { name: 'Rename' }).click();
    const dlg = page.getByRole('dialog', { name: 'Rename list' });
    await dlg.getByLabel('List name').fill('Hacked');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await friendlyText(dlg.getByTestId('rename-error-text'), MSG.protectedList);
    expect((await apiLists(v)).find((l) => l.isDefault)!.name).toBe('Shortlisted');
  });

  test('AC8/AC10 SHORTLIST_NOT_FOUND on delete: list deleted in another session; friendly sentence and lists reloaded', async ({ page }) => {
    const { v } = await boot();
    await apiLists(v);
    const tmp = await apiCreate(v, 'Gone soon');
    await apiCreate(v, 'Stays');
    await signIn(page, v);
    await openLists(page);
    await pick(page, 'Gone soon');
    await apiDeleteList(v, tmp.id); // another session
    await page.getByRole('button', { name: 'Delete list' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await friendlyText(page.getByTestId('shortlists-error-text'), MSG.notFound);
    await expect(selectList(page, 'Gone soon')).toHaveCount(0);
    await expect(selectList(page, 'Stays')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await shot(page, 'ac8-not-found');
  });

  test('AC8 SHORTLIST_NOT_FOUND on rename and on a drawer tick (lists deleted in another session)', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    const r = await apiCreate(v, 'Rename me');
    const d = await apiCreate(v, 'Tick me');
    await signIn(page, v);
    await openLists(page);
    await pick(page, 'Rename me');
    await apiDeleteList(v, r.id);
    await page.getByTestId('rename-list').click();
    const dlg = page.getByRole('dialog', { name: 'Rename list' });
    await dlg.getByLabel('List name').fill('Renamed');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await friendlyText(page.getByTestId('shortlists-error-text'), MSG.notFound);
    await expect(selectList(page, 'Rename me')).toHaveCount(0);
    // drawer
    await openCards(page, city);
    await openDrawer(page);
    await apiDeleteList(v, d.id);
    await drawer(page).getByRole('checkbox', { name: 'Tick me' }).click();
    await friendlyText(page.getByTestId('shortlist-drawer-error-text'), MSG.notFound);
    await expect(drawer(page).getByRole('checkbox', { name: 'Tick me' })).toHaveCount(0);
    await expect(drawer(page).getByRole('checkbox', { name: 'Shortlisted' })).toBeVisible();
  });
});

// ------------------------------------------------------------------ AC12
async function cityProfile(city: string): Promise<{ profileRef: string }> {
  return db(async (c) => (await c.query(
    `select p."profileRef" from "Profiles" p join "ProfileLocations" l on l."profileId"=p.id where l.city=$1`, [city])).rows[0]);
}

test.describe('AC12 360 px', () => {
  test('AC12 /app (host of the card Shortlist button and the new header link) has no horizontal scroll at 360 px', async ({ page }) => {
    const { v, city } = await boot();
    await signIn(page, v);
    await openCards(page, city);
    const probe = await page.evaluate(() => {
      const header = document.querySelector('header');
      const link = [...document.querySelectorAll('header a')].find((a) => a.textContent?.trim() === 'Shortlists');
      const before = document.documentElement.scrollWidth;
      link?.parentElement?.setAttribute('data-probe', '1');
      (link?.closest('[class*="inline-flex"]') as HTMLElement | null)?.style.setProperty('display', 'none');
      return { innerWidth: window.innerWidth, scrollWidth: before, scrollWidthWithoutShortlistsLink: document.documentElement.scrollWidth, headerRight: header?.getBoundingClientRect().right };
    });
    console.log('AC12 /app header probe', JSON.stringify(probe));
    await page.reload();
    await expect(cards(page)).toHaveCount(1);
    await shot(page, 'ac12-app-header');
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test('AC12 drawer (26 lists, long unbroken name), list view, rename and delete dialogs, empty state: no horizontal scroll, actions reachable', async ({ page }) => {
    const { v, city } = await boot();
    const [def] = await apiLists(v);
    const longName = 'W'.repeat(100);
    const lng = await apiCreate(v, longName);
    for (let i = 0; i < 5; i++) await apiCreate(v, `Many ${i}`);
    const extra = await seedProfile({ first: 'Longnamer', city: `${city}x` });
    await apiAdd(v, lng.id, extra.profileRef);
    await apiAdd(v, def.id, extra.profileRef);
    await signIn(page, v);
    // the drawer is opened from the detail page here so the check is not polluted by the /app header (own test below)
    await page.goto(`/profile/${(await cityProfile(city)).profileRef}`);
    await page.getByTestId('profile-detail').getByTestId('shortlist-button').click();
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByTestId('shortlist-drawer-loading')).toHaveCount(0);
    expect(await noHorizontalScroll(page)).toBe(true);
    const d = drawer(page);
    expect(await withinWidth(page, d.getByLabel('Create new list'))).toBe(true);
    expect(await withinWidth(page, d.getByTestId('shortlist-create-submit'))).toBe(true);
    expect(await withinWidth(page, d.getByRole('checkbox', { name: longName }))).toBe(true);
    expect(await withinWidth(page, d.getByRole('button', { name: 'Close' }))).toBe(true);
    await createViaDrawer(page, '');
    expect(await noHorizontalScroll(page)).toBe(true);
    await shot(page, 'ac12-drawer');
    await page.keyboard.press('Escape');
    await openLists(page);
    await pick(page, longName);
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByRole('button', { name: 'Rename' }))).toBe(true);
    expect(await withinWidth(page, page.getByRole('button', { name: 'Delete list' }))).toBe(true);
    expect(await withinWidth(page, page.getByRole('button', { name: /^Remove Longnamer from/ }))).toBe(true);
    await shot(page, 'ac12-list');
    await page.getByRole('button', { name: 'Rename' }).click();
    const rn = page.getByRole('dialog', { name: 'Rename list' });
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, rn.getByRole('button', { name: 'Save' }))).toBe(true);
    expect(await withinWidth(page, rn.getByRole('button', { name: 'Cancel' }))).toBe(true);
    await rn.getByLabel('List name').fill('');
    await rn.getByRole('button', { name: 'Save' }).click();
    expect(await noHorizontalScroll(page)).toBe(true);
    await shot(page, 'ac12-rename');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Delete list' }).click();
    const dl = page.getByRole('dialog', { name: new RegExp('^Delete the list') });
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, dl.getByRole('button', { name: 'Delete', exact: true }))).toBe(true);
    expect(await withinWidth(page, dl.getByRole('button', { name: 'Keep list' }))).toBe(true);
    await shot(page, 'ac12-delete');
    await page.keyboard.press('Escape');
    await pick(page, 'Many 0');
    await expect(page.getByTestId('shortlist-empty')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByRole('link', { name: 'Find profiles' }))).toBe(true);
    await shot(page, 'ac12-empty');
  });
});

// ------------------------------------------------------------------ AC13
test.describe('AC13 keyboard and axe', () => {
  test('AC13 Escape still closes the drawer after a checkbox was ticked with the mouse (focus must not be lost)', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    const cb = drawer(page).getByRole('checkbox', { name: 'Shortlisted' });
    await cb.click();
    await expect(cb).toBeChecked();
    await expect(cb).toBeEnabled();
    const active = await page.evaluate(() => ({ tag: document.activeElement?.tagName, inside: !!document.activeElement?.closest('[data-testid="shortlist-drawer"]') }));
    console.log('AC13 focus after tick', JSON.stringify(active));
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
  });

  test('AC13 drawer by keyboard: Tab to button, Enter opens, focus inside and trapped, Space ticks, Escape closes and returns focus', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    await signIn(page, v);
    await openCards(page, city);
    const btn = cards(page).getByTestId('shortlist-button');
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByTestId('shortlist-drawer-loading')).toHaveCount(0);
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="shortlist-drawer"]'))).toBe(true);
    await page.keyboard.press('Tab');
    await expect(drawer(page).getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(drawer(page).getByRole('checkbox', { name: 'Shortlisted' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(drawer(page).getByRole('checkbox', { name: 'Shortlisted' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(drawer(page).getByLabel('Create new list')).toBeFocused();
    await page.keyboard.type('Keyboard list');
    await page.keyboard.press('Enter');
    await expect(drawer(page).getByRole('checkbox', { name: 'Keyboard list' })).toBeVisible();
    // Tab stays inside the drawer
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="shortlist-drawer"]'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
    await expect(btn).toBeFocused();
  });

  test('AC13 rename and delete dialogs by keyboard: focus in, Escape closes, focus back on the trigger; Enter submits rename', async ({ page }) => {
    const { v } = await boot();
    await apiLists(v);
    await apiCreate(v, 'Kbd');
    await signIn(page, v);
    await openLists(page);
    await pick(page, 'Kbd');
    const rename = page.getByRole('button', { name: 'Rename' });
    await rename.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog', { name: 'Rename list' });
    await expect(dlg).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="rename-dialog"]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(rename).toBeFocused();
    await page.keyboard.press('Enter');
    await dlg.getByLabel('List name').fill('Kbd renamed');
    await page.keyboard.press('Enter');
    await expect(dlg).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Kbd renamed', level: 2 })).toBeVisible();
    const del = page.getByRole('button', { name: 'Delete list' });
    await del.focus();
    await page.keyboard.press('Space');
    const cd = page.getByRole('dialog', { name: /^Delete the list/ });
    await expect(cd.getByRole('button', { name: 'Keep list' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(cd).toHaveCount(0);
    await expect(del).toBeFocused();
  });

  test('AC13 axe: no serious or critical violations on drawer, list view, rename, delete, empty state', async ({ page }) => {
    const { v, city } = await boot();
    const [def] = await apiLists(v);
    const lst = await apiCreate(v, 'Axe list');
    const t = await seedProfile({ first: 'Axeprofile', city: `${city}a` });
    await apiAdd(v, lst.id, t.profileRef);
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    const results: Record<string, string[]> = {};
    results.drawer = await serious(page);
    await page.keyboard.press('Escape');
    await openLists(page);
    await pick(page, 'Axe list');
    await expect(page.getByTestId('shortlist-cards').getByTestId('profile-card')).toHaveCount(1);
    results.listView = await serious(page);
    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('dialog', { name: 'Rename list' }).getByLabel('List name').fill('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('field-error-shortlist-rename-name')).toBeVisible();
    results.rename = await serious(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Delete list' }).click();
    await expect(page.getByRole('dialog', { name: /^Delete the list/ })).toBeVisible();
    results.delete = await serious(page);
    await page.keyboard.press('Escape');
    await pick(page, 'Shortlisted');
    await expect(page.getByTestId('shortlist-empty')).toBeVisible();
    results.empty = await serious(page);
    console.log('AXE', JSON.stringify(results));
    expect(results).toEqual({ drawer: [], listView: [], rename: [], delete: [], empty: [] });
    void def;
  });
});

// ------------------------------------------------------------------ iteration 2 (round 1 verdict follow-ups)
test.describe('Iteration 2 follow-ups', () => {
  test('AC1/AC13 Escape closes the drawer after a tick AND an untick (focus kept, checkbox aria-disabled while busy)', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    const cb = drawer(page).getByRole('checkbox', { name: 'Shortlisted' });
    await cb.click();
    await expect(cb).toBeChecked();
    await expect(cb).not.toHaveAttribute('aria-disabled', 'true');
    await cb.click();
    await expect(cb).not.toBeChecked();
    await expect(cb).not.toHaveAttribute('aria-disabled', 'true');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="shortlist-drawer"]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
  });

  test('AC2 in-flight checkbox: aria-disabled exposed, repeated click and Space send exactly one request, Escape still works while busy (delay-only route)', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    await signIn(page, v);
    await openCards(page, city);
    await openDrawer(page);
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    const reqs: string[] = [];
    await page.route('**/shortlists/*/profiles/*', async (route) => {
      reqs.push(route.request().method());
      if (route.request().method() === 'PUT') await held;
      await route.continue();
    });
    const cb = drawer(page).getByRole('checkbox', { name: 'Shortlisted' });
    await cb.click();
    await expect(cb).toHaveAttribute('aria-disabled', 'true');
    await expect(cb).toBeDisabled();
    // screen reader state: the accessibility tree reports it as disabled
    await expect(page.getByRole('checkbox', { name: 'Shortlisted', disabled: true })).toHaveCount(1);
    await cb.click({ force: true });
    await cb.click({ force: true });
    await cb.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    expect(reqs).toEqual(['PUT']);
    release();
    await expect(cb).toBeChecked();
    await expect(cb).toBeEnabled();
    expect(reqs).toEqual(['PUT']);
    expect(await apiMembers(v, (await apiLists(v))[0].id)).toHaveLength(1);
    // untick: also exactly one DELETE despite repeated clicks (re-hold not needed; clicks land after completion are real toggles, so only one click here)
    await cb.click();
    await expect(cb).not.toBeChecked();
    expect(reqs).toEqual(['PUT', 'DELETE']);
  });

  test('AC1 membership walk concurrency: 26 lists, at most 4 parallel GET /shortlists/:id/profiles (peak read from in-flight log; delay-only route)', async ({ page }) => {
    const { v, city } = await boot();
    await apiLists(v);
    for (let i = 0; i < 25; i++) await apiCreate(v, `Walk ${i}`);
    await signIn(page, v);
    await openCards(page, city);
    let inflight = 0;
    let peak = 0;
    let total = 0;
    await page.route(/\/shortlists\/[^/]+\/profiles(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      inflight++; total++; peak = Math.max(peak, inflight);
      try {
        await new Promise((r) => setTimeout(r, 120)); // simulated latency so overlap is observable
        await route.continue();
      } finally { inflight--; }
    });
    await cards(page).getByTestId('shortlist-button').click();
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByTestId('shortlist-drawer-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(drawer(page).getByRole('checkbox')).toHaveCount(26);
    console.log('WALK concurrency', JSON.stringify({ total, peak }));
    expect(total).toBeGreaterThanOrEqual(26);
    expect(peak).toBeGreaterThan(1);
    // The dev server runs React.StrictMode (main.tsx), which mounts the drawer effect twice, so two walks of 26 lists
    // overlap (total 52). The limit is 4 per walk, so the peak must stay within 4 x number of walks.
    const walks = Math.ceil(total / 26);
    expect(peak).toBeLessThanOrEqual(4 * walks);
  });

  test('Logout clears the shortlist cache: second member in the same browser context sees none of the first member\'s lists or ticks', async ({ page }) => {
    const { v, city, t } = await boot();
    const [def] = await apiLists(v);
    await apiCreate(v, 'FirstMemberOnly');
    await apiAdd(v, def.id, t.profileRef);
    const v2 = await viewer();
    await page.addInitScript(
      ([a, r]) => {
        if (!sessionStorage.getItem('seeded1')) {
          sessionStorage.setItem('seeded1', '1');
          localStorage.setItem('user_access_token', a);
          localStorage.setItem('user_refresh_token', r);
        }
      },
      [v.token, v.refresh],
    );
    await openCards(page, city);
    await openDrawer(page);
    await expect(drawer(page).getByRole('checkbox', { name: 'Shortlisted' })).toBeChecked();
    await expect(drawer(page).getByRole('checkbox', { name: 'FirstMemberOnly' })).toBeVisible();
    await drawer(page).getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('user_access_token'))).toBeNull();
    // sign in as the second member through the login form, with no page reload, so module state (the cache) survives
    await expect(page).toHaveURL(/\/login$/);
    await page.getByTestId('login-email').fill(v2.email);
    await page.getByTestId('login-password').fill(v2.password);
    const log = track(page);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('results-list').getByTestId('profile-card').first()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('results-list').getByTestId('profile-card').first().getByTestId('shortlist-button').click();
    await expect(drawer(page)).toBeVisible();
    await expect(page.getByTestId('shortlist-drawer-loading')).toHaveCount(0);
    await expect(drawer(page).getByRole('checkbox', { name: 'FirstMemberOnly' })).toHaveCount(0);
    await expect(drawer(page).getByRole('checkbox', { name: 'Shortlisted' })).not.toBeChecked();
    await expect(drawer(page).getByRole('checkbox')).toHaveCount(1);
    const v2Default = (await apiLists(v2))[0];
    // the second member's own default list was walked from the server (cache was empty for it)
    expect(log.some((e) => e.method === 'GET' && e.path.includes(`/shortlists/${v2Default.id}/profiles`))).toBe(true);
    expect(log.some((e) => e.path.includes(def.id))).toBe(false);
  });
});

test('Network: no request leaves the allowed origins', async ({ page }) => {
  const { v, city } = await boot();
  await signIn(page, v);
  const origins = new Set<string>();
  page.on('request', (r) => origins.add(new URL(r.url()).origin));
  await openCards(page, city);
  await openDrawer(page);
  await page.keyboard.press('Escape');
  await openLists(page);
  const allowed = [USER, 'http://127.0.0.1:3101', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
  expect([...origins].filter((o) => !allowed.includes(o))).toEqual([]);
  const r = await call('GET', '/shortlists', { token: v.token });
  expect(r.status).toBe(200);
});
