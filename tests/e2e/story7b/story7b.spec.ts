/**
 * Phase 1 story 7b: member interests UI (Send interest on cards and detail, /interests tabs, filter, pagination,
 * Accept / Decline / Withdraw dialogs) and the AdminPanel Clear cooldown page.
 * Harness: real backend (dist/main.js, port 3101, test DB, fake storage) + UserWeb dev (5190) + AdminPanel dev (5183).
 * Seeding: approved members through the real endpoints (memberAt, story 5b); the receiver is relabelled female and moved
 * to a unique city tag in the test DB so the sender finds exactly that one card. Pagination uses 25 seeded approved
 * women (support6b seedProfile) that the sender reaches through the real POST /interests. Viewport 360 x 780.
 * Two-member specs use two browser contexts (one per member).
 *
 * MOCKED / BYPASSING cases (everything else is a real server answer, nothing is mocked):
 *  - "delay only" routes (skeleton rows, double click busy window): page.route holds the real request and continues it.
 *  - AC12 admin INVALID_REASON_CODE: page.route rewrites `reasonCode` of the real POST to an unknown value and forwards it
 *    (bypass: the select only offers valid codes).
 *  - AC12 INTEREST_ALREADY_EXISTS, INTEREST_COOLDOWN, INVALID_STATUS_TRANSITION and COOLDOWN_NOT_FOUND: no route at all;
 *    state is arranged through real endpoints in another session (accept by B, decline by B) and a fresh page load, so no
 *    client-side check had to be bypassed.
 */
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '../../../AdminPanel/node_modules/@axe-core/playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ADMIN, FRIENDLY_BAD, USER, actApi, noHorizontalScroll, party, seedProfile, sendApi, signIn, tagCity, withinWidth, call,
  type Party,
} from './support7b';

const ART = path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-7b');
mkdirSync(ART, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${ART}/${name}.png`, fullPage: true });
const adminSeed = () => JSON.parse(readFileSync(path.resolve(ART, '..', 'ui-seed.json'), 'utf8'));

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const CHAT = 'You can chat once chat is available';

async function ctxFor(browser: Browser, p: Party) {
  const context = await browser.newContext({ baseURL: USER, viewport: { width: 360, height: 780 } });
  const page = await context.newPage();
  await signIn(page, p.m);
  return { context, page };
}

async function adminLogin(page: Page) {
  const s = adminSeed();
  await page.goto(`${ADMIN}/login`);
  await page.getByPlaceholder('admin@dhobimatrimony.com').fill(s.email);
  await page.getByPlaceholder('••••••••').fill(s.password);
  await page.getByRole('button', { name: 'Sign In to Console' }).click();
  await page.waitForURL((u) => u.pathname === '/');
}

async function adminCooldownPage(page: Page) {
  await adminLogin(page);
  await page.goto(`${ADMIN}/interest-cooldown`);
  await expect(page.getByRole('heading', { name: 'Interest cooldown' })).toBeVisible();
}

async function fillAdmin(page: Page, sender: string, receiver: string, reason = 'member-appeal') {
  await page.getByTestId('cooldown-sender').fill(sender);
  await page.getByTestId('cooldown-receiver').fill(receiver);
  await page.getByTestId('cooldown-reason').selectOption(reason);
}

async function friendlyText(loc: Locator, expected?: string | RegExp) {
  await expect(loc).toBeVisible();
  const text = (await loc.innerText()).trim();
  for (const re of FRIENDLY_BAD) expect(text, `must not match ${re}`).not.toMatch(re);
  if (typeof expected === 'string') expect(text).toBe(expected);
  else if (expected) expect(text).toMatch(expected);
  return text;
}

async function serious(page: Page, include?: string) {
  const b = new AxeBuilder({ page });
  if (include) b.include(include);
  const r = await b.analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}:${v.impact}:${v.nodes.length}:${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

const items = (page: Page) => page.getByTestId('interest-item');
const cardButton = (page: Page) => page.getByTestId('results-list').getByTestId('profile-card').getByTestId('send-interest-button');
const detailButton = (page: Page) => page.getByTestId('profile-detail').getByTestId('send-interest-button');

async function openSent(page: Page, filter?: string) {
  await page.goto('/interests');
  await expect(page.getByRole('tab', { name: 'Sent', selected: true })).toBeVisible();
  if (filter) await page.getByLabel('Status').selectOption({ label: filter });
}
async function openReceived(page: Page) {
  await page.goto('/interests');
  await page.getByRole('tab', { name: 'Received' }).click();
  await expect(page.getByRole('tab', { name: 'Received', selected: true })).toBeVisible();
}

async function cardsFor(page: Page, city: string) {
  await page.goto(`/app?city=${city}`);
  await expect(page.getByTestId('results-list').getByTestId('profile-card')).toHaveCount(1);
}

// ------------------------------------------------------------------ AC1
test.describe('AC1 send from card and detail', () => {
  test('AC1 card: one POST on double click, busy label, "Interest sent", repeat on fresh load = already exists; no note field; origins', async ({ page }) => {
    const city = tagCity();
    const a = await party();
    const b = await party({ city, female: true });
    await signIn(page, a.m);
    const origins = new Set<string>();
    page.on('request', (r) => origins.add(new URL(r.url()).origin));
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    let posts = 0;
    await page.route('**/interests', async (route) => {
      if (route.request().method() === 'POST') { posts++; await held; }
      await route.continue();
    });
    await cardsFor(page, city);
    await expect(page.getByTestId('results-list').getByTestId('profile-card').locator('textarea, input[type="text"]')).toHaveCount(0);
    const btn = cardButton(page);
    await expect(btn).toHaveText('Send interest');
    await btn.dblclick();
    await expect(btn).toHaveText('Sending...');
    await expect(btn).toBeDisabled();
    release();
    await expect(btn).toHaveText('Interest sent');
    await expect(btn).toBeDisabled();
    expect(posts).toBe(1);
    await shot(page, 'ac1-card-sent');
    await page.unroute('**/interests');
    // fresh load: the card carries no state, the server answers INTEREST_ALREADY_EXISTS
    await cardsFor(page, city);
    await expect(cardButton(page)).toHaveText('Send interest');
    await cardButton(page).click();
    await friendlyText(page.getByTestId('send-interest-error-text'), 'You have already sent an interest to this member.');
    await expect(cardButton(page)).toHaveText('Interest sent');
    await expect(cardButton(page)).toBeDisabled();
    console.log('AC1 origins', JSON.stringify([...origins]));
    // Google Fonts (UserWeb/index.html stylesheet) is the only third-party origin; it is not an app call. Reported as surprising.
    const allowed = ['http://localhost:5190', 'http://127.0.0.1:3101', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
    expect([...origins].filter((o) => !allowed.includes(o))).toEqual([]);
    void b;
  });

  test('AC1 detail page: button sends one POST, becomes "Interest sent"; repeat shows already-exists sentence', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    await signIn(page, a.m);
    let posts = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/interests')) posts++; });
    await page.goto(`/profile/${b.profileRef}`);
    await expect(detailButton(page)).toHaveText('Send interest');
    await expect(page.locator('textarea')).toHaveCount(0);
    await detailButton(page).click();
    await expect(detailButton(page)).toHaveText('Interest sent');
    await expect(detailButton(page)).toBeDisabled();
    expect(posts).toBe(1);
    await page.reload();
    await detailButton(page).click();
    await friendlyText(page.getByTestId('send-interest-error-text'), 'You have already sent an interest to this member.');
    await expect(detailButton(page)).toHaveText('Interest sent');
    await shot(page, 'ac1-detail');
  });
});

// ------------------------------------------------------------------ AC2 / AC3
test.describe('AC2 AC3 tabs, filter, pagination, empty states', () => {
  test('AC2 tablist with arrow keys; tab and filter changes reload page one with the status parameter', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    await sendApi(a, b);
    await signIn(page, a.m);
    await page.goto('/interests');
    const tablist = page.getByRole('tablist');
    await expect(tablist.getByRole('tab')).toHaveText(['Sent', 'Received']);
    await expect(page.getByRole('tab', { name: 'Sent', selected: true })).toBeVisible();
    const sentFilter = await page.getByLabel('Status').locator('option').allInnerTexts();
    expect(sentFilter).toEqual(['All', 'Pending', 'Accepted', 'Not accepted', 'Withdrawn']);
    await page.getByRole('tab', { name: 'Sent' }).focus();
    const rec = page.waitForRequest((r) => r.url().includes('/interests/received'));
    await page.keyboard.press('ArrowRight');
    const recReq = await rec;
    await expect(page.getByRole('tab', { name: 'Received', selected: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Received' })).toBeFocused();
    expect(new URL(recReq.url()).searchParams.has('cursor')).toBe(false);
    const recFilter = await page.getByLabel('Status').locator('option').allInnerTexts();
    expect(recFilter).toEqual(['All', 'Pending', 'Accepted', 'Declined', 'Withdrawn']);
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Sent', selected: true })).toBeVisible();
    for (const [label, value] of [['Pending', 'pending'], ['Accepted', 'accepted'], ['Not accepted', 'declined'], ['Withdrawn', 'withdrawn']]) {
      const req = page.waitForRequest((r) => r.url().includes('/interests/sent') && r.url().includes(`status=${value}`));
      await page.getByLabel('Status').selectOption({ label });
      const u = new URL((await req).url());
      expect(u.searchParams.get('status')).toBe(value);
      expect(u.searchParams.has('cursor')).toBe(false);
    }
  });

  test('AC3 20 per page, Load more only while nextCursor, no duplicates; skeleton while loading', async ({ page }) => {
    const a = await party();
    const seeds = [];
    for (let i = 0; i < 25; i++) seeds.push(await seedProfile({ first: `Pg${String(i).padStart(2, '0')}` }));
    for (const s of seeds) {
      const r = await call('POST', '/interests', { token: a.m.token, body: { receiverProfileRef: s.profileRef } });
      if (r.status !== 201) throw new Error(`seed send -> ${r.status} ${r.text.slice(0, 200)}`);
    }
    await signIn(page, a.m);
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    await page.route('**/interests/sent**', async (route) => { await held; await route.continue().catch(() => {}); });
    await page.goto('/interests');
    await expect(page.getByTestId('interests-loading')).toBeVisible();
    await expect(page.getByTestId('interest-skeleton')).toHaveCount(3);
    await shot(page, 'ac3-skeleton');
    release();
    await expect(items(page)).toHaveCount(20);
    const more = page.getByRole('button', { name: 'Load more' });
    await expect(more).toBeVisible();
    const req = page.waitForRequest((r) => r.url().includes('cursor='));
    await more.click();
    expect(new URL((await req).url()).searchParams.get('limit')).toBe('20');
    await expect(items(page)).toHaveCount(25);
    await expect(more).toHaveCount(0);
    const names = await items(page).locator('h3').allInnerTexts();
    expect(new Set(names).size).toBe(25);
  });

  test('AC3 empty states: sent, received, filtered', async ({ page }) => {
    const a = await party();
    await signIn(page, a.m);
    await page.goto('/interests');
    await expect(page.getByTestId('interests-empty')).toHaveText("You haven't sent any interests yet. Find profiles on the search page.");
    await page.getByRole('tab', { name: 'Received' }).click();
    await expect(page.getByTestId('interests-empty')).toHaveText("You haven't received any interests yet.");
    await page.getByLabel('Status').selectOption({ label: 'Accepted' });
    await expect(page.getByTestId('interests-empty')).toHaveText('No interests with this status.');
    await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ AC4
test('AC4 item content: card fields only, status, date; no chat label, no contact, no "mutual"', async ({ page }) => {
  const a = await party();
  const b = await party({ female: true });
  await sendApi(a, b);
  await signIn(page, b.m);
  await openReceived(page);
  const item = items(page).first();
  await expect(item.getByTestId('interest-status')).toHaveText('Pending');
  await expect(item.getByTestId('interest-date')).toHaveText(/^\d{1,2} \w+ \d{4}$/);
  await expect(item.getByTestId('interest-chat')).toHaveCount(0);
  await expect(item.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/mutual/i);
  expect(text).not.toContain(CHAT);
  expect(text).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  expect(text).not.toContain(a.m.mobile);
  expect(await item.innerHTML()).not.toContain(a.m.userId);
  await expect(item.getByRole('link')).toHaveAttribute('href', `/profile/${a.profileRef}`);
});

// ------------------------------------------------------------------ AC5 / AC6
test.describe('AC5 AC6 actions with confirmation', () => {
  test('AC5 decline: dialog title, Cancel and Escape send nothing and return focus, confirm sends one request; actions absent after', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    await sendApi(a, b);
    await signIn(page, b.m);
    let acts = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && /\/interests\/[^/]+\/(accept|decline|withdraw)$/.test(r.url())) acts++; });
    await openReceived(page);
    const decline = items(page).first().getByRole('button', { name: 'Decline' });
    await decline.click();
    const dlg = page.getByRole('dialog', { name: 'Decline this interest? The sender will see Not accepted.' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toHaveCount(0);
    await expect(decline).toBeFocused();
    await decline.press('Space');
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(decline).toBeFocused();
    expect(acts).toBe(0);
    await decline.click();
    await page.getByRole('button', { name: 'Yes, decline' }).click();
    await expect(items(page).first().getByTestId('interest-status')).toHaveText('Declined');
    expect(acts).toBe(1);
    await expect(items(page).first().getByRole('button')).toHaveCount(0);
  });

  test('AC5 accept: confirmation text; the item leaves a Pending filter; Sent tab has no Accept or Decline', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    await sendApi(a, b);
    await signIn(page, b.m);
    await openReceived(page);
    await page.getByLabel('Status').selectOption({ label: 'Pending' });
    await expect(items(page)).toHaveCount(1);
    await items(page).first().getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByRole('dialog', { name: 'Accept this interest?' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes, accept' }).click();
    await expect(items(page)).toHaveCount(0);
    await expect(page.getByTestId('interests-empty')).toHaveText('No interests with this status.');
    await page.getByLabel('Status').selectOption({ label: 'All' });
    await expect(items(page).first().getByTestId('interest-status')).toHaveText('Accepted');
    await page.getByRole('tab', { name: 'Sent' }).click();
    await expect(page.getByTestId('interests-empty')).toBeVisible();
  });

  test('AC5 Sent tab pending item offers Withdraw only', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    await sendApi(a, b);
    await signIn(page, a.m);
    await openSent(page);
    const it = items(page).first();
    await expect(it.getByRole('button', { name: 'Withdraw' })).toBeVisible();
    await expect(it.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await expect(it.getByRole('button', { name: 'Decline' })).toHaveCount(0);
  });

  test('AC6 withdraw: dialog, one request, "Withdrawn", no action left; card Send works again on fresh load', async ({ page }) => {
    const city = tagCity();
    const a = await party();
    const b = await party({ city, female: true });
    await sendApi(a, b);
    await signIn(page, a.m);
    let acts = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/withdraw')) acts++; });
    await openSent(page);
    await items(page).first().getByRole('button', { name: 'Withdraw' }).click();
    await expect(page.getByRole('dialog', { name: 'Withdraw this interest?' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes, withdraw' }).click();
    await expect(items(page).first().getByTestId('interest-status')).toHaveText('Withdrawn');
    expect(acts).toBe(1);
    await expect(items(page).first().getByRole('button')).toHaveCount(0);
    await cardsFor(page, city);
    await cardButton(page).click();
    await expect(cardButton(page)).toHaveText('Interest sent');
    await expect(page.getByTestId('send-interest-error')).toHaveCount(0);
  });

  test('AC6 no action on a declined or accepted Sent item', async ({ page }) => {
    const a = await party();
    const b1 = await party({ female: true });
    const b2 = await party({ female: true });
    const i1 = await sendApi(a, b1);
    const i2 = await sendApi(a, b2);
    await actApi(b1, i1.id, 'decline');
    await actApi(b2, i2.id, 'accept');
    await signIn(page, a.m);
    await openSent(page);
    await expect(items(page)).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Withdraw' })).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ AC7 / AC8 / AC9
test.describe('AC7 AC8 AC9 two members', () => {
  test('AC7 A sends from the card, B declines, A sees "Not accepted" (neutral), B sees "Declined"; AC8 cooldown message with retry date', async ({ browser }) => {
    const city = tagCity();
    const a = await party();
    const b = await party({ city, female: true });
    const A = await ctxFor(browser, a);
    const B = await ctxFor(browser, b);
    try {
      await cardsFor(A.page, city);
      await cardButton(A.page).click();
      await expect(cardButton(A.page)).toHaveText('Interest sent');
      await openReceived(B.page);
      await items(B.page).first().getByRole('button', { name: 'Decline' }).click();
      await B.page.getByRole('button', { name: 'Yes, decline' }).click();
      await expect(items(B.page).first().getByTestId('interest-status')).toHaveText('Declined');
      await openSent(A.page);
      const it = items(A.page).first();
      await expect(it.getByTestId('interest-status')).toHaveText('Not accepted');
      const text = await it.innerText();
      expect(text).not.toMatch(NOT_WORDS);
      expect(await it.getByRole('button').count()).toBe(0);
      await shot(A.page, 'ac7-a-not-accepted');
      await A.page.getByLabel('Status').selectOption({ label: 'Not accepted' });
      await expect(items(A.page)).toHaveCount(1);
      await shot(B.page, 'ac7-b-declined');
      // AC8: re-send hits the cooldown; the real response carries retryAfter
      await cardsFor(A.page, city);
      const resp = A.page.waitForResponse((r) => r.url().endsWith('/interests') && r.request().method() === 'POST');
      await cardButton(A.page).click();
      const body = JSON.stringify(await (await resp).json());
      const retry = /"retryAfter":"([^"]+)"/.exec(body)?.[1];
      expect(retry, body).toBeTruthy();
      const day = DAY.format(new Date(retry!));
      const sentence = await friendlyText(A.page.getByTestId('send-interest-error-text'), `You can send another interest to this member on ${day}.`);
      console.log('AC8 cooldown sentence:', sentence);
      await expect(cardButton(A.page)).toHaveText(`Available on ${day}`);
      await expect(cardButton(A.page)).toBeDisabled();
      await A.page.reload();
      await expect(cardButton(A.page)).toHaveText('Send interest');
      await expect(cardButton(A.page)).toBeEnabled();
    } finally {
      await A.context.close();
      await B.context.close();
    }
  });

  test('AC9 B accepts in the UI: both lists show Accepted and the chat label as plain text', async ({ browser }) => {
    const a = await party();
    const b = await party({ female: true });
    await sendApi(a, b);
    const A = await ctxFor(browser, a);
    const B = await ctxFor(browser, b);
    try {
      await openReceived(B.page);
      await items(B.page).first().getByRole('button', { name: 'Accept' }).click();
      await B.page.getByRole('button', { name: 'Yes, accept' }).click();
      await expect(items(B.page).first().getByTestId('interest-status')).toHaveText('Accepted');
      await openSent(A.page);
      await expect(items(A.page).first().getByTestId('interest-status')).toHaveText('Accepted');
      for (const p of [A.page, B.page]) {
        await expect(items(p).first().getByTestId('interest-chat')).toHaveText(CHAT);
        await expect(items(p).first().getByTestId('interest-chat').locator('a, button')).toHaveCount(0);
        await expect(items(p).first().getByRole('button')).toHaveCount(0);
      }
    } finally {
      await A.context.close();
      await B.context.close();
    }
  });

  test('AC9 two pending interests in opposite directions: no chat label on either side', async ({ browser }) => {
    const a = await party();
    const b = await party({ female: true });
    await sendApi(a, b);
    await sendApi(b, a);
    const A = await ctxFor(browser, a);
    const B = await ctxFor(browser, b);
    try {
      await openSent(A.page);
      await expect(items(A.page)).toHaveCount(1);
      await openSent(B.page);
      await expect(items(B.page)).toHaveCount(1);
      await openReceived(A.page);
      await expect(items(A.page)).toHaveCount(1);
      for (const p of [A.page, B.page]) {
        await expect(p.getByTestId('interest-chat')).toHaveCount(0);
        expect(await p.locator('main').innerText()).not.toMatch(/mutual/i);
      }
    } finally {
      await A.context.close();
      await B.context.close();
    }
  });
});
const NOT_WORDS = /declin|reject|reason/i;

// ------------------------------------------------------------------ AC10 / AC12 AdminPanel
test.describe('AC10 AdminPanel Clear cooldown', () => {
  test('AC10 form: dashboard link, four reason codes, notes max 500, confirmation Cancel and Escape send nothing', async ({ page }) => {
    await adminLogin(page);
    await page.getByRole('button', { name: 'Interest cooldown' }).click();
    await expect(page).toHaveURL(`${ADMIN}/interest-cooldown`);
    const options = await page.getByTestId('cooldown-reason').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(options).toEqual(['', 'member-appeal', 'admin-error', 'goodwill', 'other']);
    await expect(page.getByTestId('cooldown-clear')).toBeDisabled();
    await page.getByTestId('cooldown-notes').fill('x'.repeat(600));
    expect(await page.getByTestId('cooldown-notes').inputValue()).toHaveLength(500);
    await expect(page.getByTestId('cooldown-remaining')).toHaveText('0 characters remaining');
    let posts = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/cooldown/clear')) posts++; });
    await fillAdmin(page, 'S123', 'abc');
    await page.getByTestId('cooldown-clear').click();
    const dlg = page.getByRole('dialog', { name: 'Clear the resend cooldown for this pair?' });
    await expect(dlg).toBeVisible();
    await expect(page.getByTestId('cooldown-cancel')).toBeFocused();
    await page.getByTestId('cooldown-cancel').click();
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId('cooldown-clear')).toBeFocused();
    await page.getByTestId('cooldown-clear').press('Enter');
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    expect(posts).toBe(0);
  });

  test('AC10 success then A can send at once; AC12 COOLDOWN_NOT_FOUND on repeat (real, no bypass)', async ({ page, browser }) => {
    const city = tagCity();
    const a = await party();
    const b = await party({ city, female: true });
    const i = await sendApi(a, b);
    await actApi(b, i.id, 'decline');
    const A = await ctxFor(browser, a);
    try {
      await cardsFor(A.page, city);
      await cardButton(A.page).click();
      await expect(A.page.getByTestId('send-interest-error')).toBeVisible();
      await expect(cardButton(A.page)).toBeDisabled();
      await adminCooldownPage(page);
      await fillAdmin(page, a.profileUid, b.profileRef, 'goodwill');
      await page.getByTestId('cooldown-clear').click();
      await page.getByTestId('cooldown-confirm').click();
      await expect(page.getByTestId('cooldown-success')).toHaveText('Cooldown cleared. The sender can send an interest again.');
      await shot(page, 'ac10-success');
      await cardsFor(A.page, city);
      await cardButton(A.page).click();
      await expect(cardButton(A.page)).toHaveText('Interest sent');
      await expect(A.page.getByTestId('send-interest-error')).toHaveCount(0);
      // repeat: no active cooldown any more
      await page.getByTestId('cooldown-clear').click();
      await page.getByTestId('cooldown-confirm').click();
      await friendlyText(page.getByTestId('cooldown-error'), 'There is no active cooldown for this pair.');
      await shot(page, 'ac12-admin-cooldown-not-found');
    } finally {
      await A.context.close();
    }
  });

  test('AC12 admin invalid reason code: bypass via page.route (reasonCode rewritten), server answer shown', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    await adminCooldownPage(page);
    await page.route('**/admin/interests/cooldown/clear', async (route) => {
      const data = route.request().postDataJSON();
      await route.continue({ postData: JSON.stringify({ ...data, reasonCode: 'not-a-code' }), headers: { ...route.request().headers(), 'content-type': 'application/json' } });
    });
    await fillAdmin(page, a.profileUid, b.profileRef);
    const resp = page.waitForResponse((r) => r.url().includes('/cooldown/clear'));
    await page.getByTestId('cooldown-clear').click();
    await page.getByTestId('cooldown-confirm').click();
    const r = await resp;
    console.log('AC12 admin bad reason status', r.status(), (await r.text()).slice(0, 200));
    expect(r.status()).toBe(400);
    await friendlyText(page.getByTestId('cooldown-error'), /Choose a reason from the list/);
  });

  test('AC12 admin network failure shows the friendly sentence (aborted by page.route)', async ({ page }) => {
    await adminCooldownPage(page);
    await page.route('**/admin/interests/cooldown/clear', (route) => route.abort());
    await fillAdmin(page, 'S1', 'ref1');
    await page.getByTestId('cooldown-clear').click();
    await page.getByTestId('cooldown-confirm').click();
    await friendlyText(page.getByTestId('cooldown-error'), 'We could not reach the server. Please check your connection and try again.');
  });
});

// ------------------------------------------------------------------ AC12 member
test('AC12 INVALID_STATUS_TRANSITION: withdraw after B accepted in another session (real, no bypass)', async ({ page }) => {
  const a = await party();
  const b = await party({ female: true });
  const i = await sendApi(a, b);
  await signIn(page, a.m);
  await openSent(page);
  await expect(items(page).first().getByTestId('interest-status')).toHaveText('Pending');
  await actApi(b, i.id, 'accept'); // another session answers while A's page is stale
  await items(page).first().getByRole('button', { name: 'Withdraw' }).click();
  await page.getByRole('button', { name: 'Yes, withdraw' }).click();
  await friendlyText(
    page.getByTestId('confirm-error-text'),
    'This interest has already changed, so that action is no longer available. Please refresh to see its latest status.',
  );
  await shot(page, 'ac12-invalid-transition');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(items(page).first().getByTestId('interest-status')).toHaveText('Accepted');
});

// ------------------------------------------------------------------ AC14 / AC15
test.describe('AC14 AC15 responsive, keyboard, axe', () => {
  test('AC14 /interests at 360 px: both tabs, filter, dialogs; actions reachable', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    await sendApi(a, b);
    await signIn(page, a.m);
    await openSent(page);
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByLabel('Status').selectOption({ label: 'Pending' });
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByLabel('Status'))).toBe(true);
    expect(await withinWidth(page, items(page).first().getByRole('button', { name: 'Withdraw' }))).toBe(true);
    await items(page).first().getByRole('button', { name: 'Withdraw' }).click();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByRole('button', { name: 'Yes, withdraw' }))).toBe(true);
    expect(await withinWidth(page, page.getByRole('button', { name: 'Cancel' }))).toBe(true);
    await shot(page, 'ac14-sent-dialog');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Received' }).click();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByRole('tab', { name: 'Received' }))).toBe(true);
    await shot(page, 'ac14-received');
  });

  test('AC14 card and detail send states at 360 px', async ({ page }) => {
    const city = tagCity();
    const a = await party();
    const b = await party({ city, female: true });
    await signIn(page, a.m);
    await cardsFor(page, city);
    expect(await withinWidth(page, cardButton(page))).toBe(true);
    expect(await noHorizontalScroll(page)).toBe(true);
    await cardButton(page).click();
    await expect(cardButton(page)).toHaveText('Interest sent');
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.goto(`/profile/${b.profileRef}`);
    await detailButton(page).click();
    await expect(page.getByTestId('send-interest-error')).toBeVisible();
    expect(await withinWidth(page, detailButton(page))).toBe(true);
    expect(await noHorizontalScroll(page)).toBe(true);
    await shot(page, 'ac14-detail-sent');
  });

  test('AC14 cooldown label on card at 360 px, and AdminPanel page and dialog', async ({ page, browser }) => {
    const city = tagCity();
    const a = await party();
    const b = await party({ city, female: true });
    const i = await sendApi(a, b);
    await actApi(b, i.id, 'decline');
    const A = await ctxFor(browser, a);
    try {
      await cardsFor(A.page, city);
      await cardButton(A.page).click();
      await expect(cardButton(A.page)).toContainText('Available on');
      expect(await noHorizontalScroll(A.page)).toBe(true);
      expect(await withinWidth(A.page, cardButton(A.page))).toBe(true);
      await shot(A.page, 'ac14-cooldown-card');
    } finally {
      await A.context.close();
    }
    await adminCooldownPage(page);
    expect(await noHorizontalScroll(page)).toBe(true);
    await fillAdmin(page, 'S1', 'r1');
    expect(await withinWidth(page, page.getByTestId('cooldown-clear'))).toBe(true);
    await page.getByTestId('cooldown-clear').click();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByTestId('cooldown-confirm'))).toBe(true);
    await shot(page, 'ac14-admin-dialog');
  });

  test('AC15 keyboard: Tab reaches Send interest and Enter sends; tablist roving focus; accessible names', async ({ page }) => {
    const city = tagCity();
    const a = await party();
    await party({ city, female: true });
    await signIn(page, a.m);
    await cardsFor(page, city);
    const btn = page.getByTestId('results-list').getByRole('button', { name: 'Send interest' });
    await btn.focus();
    await expect(btn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('results-list').getByRole('button', { name: 'Interest sent' })).toBeDisabled();
    await page.goto('/interests');
    await expect(page.getByRole('tab', { name: 'Sent', selected: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Sent' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Status')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /.+/ }).filter({ hasNotText: 'Back to search' }).first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Withdraw' })).toBeFocused();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog', { name: 'Withdraw this interest?' });
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Yes, withdraw' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Withdraw' })).toBeFocused();
  });

  test('AC15 axe: /interests both tabs with filter and dialogs', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    const i = await sendApi(a, b);
    await signIn(page, a.m);
    await openSent(page);
    await expect(items(page)).toHaveCount(1);
    const sent = await serious(page);
    await items(page).first().getByRole('button', { name: 'Withdraw' }).click();
    const dlg = await serious(page);
    await page.keyboard.press('Escape');
    await actApi(b, i.id, 'accept');
    await page.reload();
    await expect(items(page).first().getByTestId('interest-chat')).toBeVisible();
    const accepted = await serious(page);
    await page.getByRole('tab', { name: 'Received' }).click();
    const rec = await serious(page);
    console.log('AC15 axe interests sent/dialog/accepted/received:', JSON.stringify({ sent, dlg, accepted, rec }));
    expect({ sent, dlg, accepted, rec }).toEqual({ sent: [], dlg: [], accepted: [], rec: [] });
  });

  test('AC15 axe: received tab with actions and decline dialog', async ({ page }) => {
    const a = await party();
    const b = await party({ female: true });
    await sendApi(a, b);
    await signIn(page, b.m);
    await openReceived(page);
    await expect(items(page)).toHaveCount(1);
    const rec = await serious(page);
    await items(page).first().getByRole('button', { name: 'Decline' }).click();
    const dlg = await serious(page);
    console.log('AC15 axe received/decline dialog:', JSON.stringify({ rec, dlg }));
    expect({ rec, dlg }).toEqual({ rec: [], dlg: [] });
  });

  test('AC15 axe: Send interest states on card and detail', async ({ page }) => {
    const city = tagCity();
    const a = await party();
    const b = await party({ city, female: true });
    await signIn(page, a.m);
    await cardsFor(page, city);
    const idle = await serious(page);
    await cardButton(page).click();
    await expect(cardButton(page)).toHaveText('Interest sent');
    const sent = await serious(page);
    await page.goto(`/profile/${b.profileRef}`);
    await detailButton(page).click();
    await expect(page.getByTestId('send-interest-error')).toBeVisible();
    const detail = await serious(page);
    console.log('AC15 axe card idle/sent, detail:', JSON.stringify({ idle, sent, detail }));
    expect({ idle, sent, detail }).toEqual({ idle: [], sent: [], detail: [] });
  });

  test('AC15 axe: AdminPanel Clear cooldown page and dialog, accessible names', async ({ page }) => {
    await adminCooldownPage(page);
    await expect(page.getByLabel('Sender profile ID')).toBeVisible();
    await expect(page.getByLabel('Receiver profile ID')).toBeVisible();
    await expect(page.getByLabel('Reason code')).toBeVisible();
    await expect(page.getByLabel('Notes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear cooldown' })).toBeVisible();
    const form = await serious(page);
    await fillAdmin(page, 'S1', 'r1');
    await page.getByRole('button', { name: 'Clear cooldown' }).click();
    const dlg = await serious(page);
    console.log('AC15 axe admin page/dialog:', JSON.stringify({ form, dlg }));
    expect({ form, dlg }).toEqual({ form: [], dlg: [] });
  });
});
