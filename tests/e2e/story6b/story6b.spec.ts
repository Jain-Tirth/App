/**
 * Phase 1 story 6b: member discovery UI (today's recommendations, filter search, cursor pagination,
 * /profile/:profileRef detail and the not-found page).
 * Harness: real backend (dist/main.js, port 3101, test DB, fake storage) + UserWeb dev server (5190).
 * Seed data (support6b.ts): 45 approved women in one tagged city (3 pages of 20/20/5; the newest is verified and has an
 * approved primary individual photo), one fully filled profile, one sparse profile, one "slow" profile, one hidden
 * target, one non-approved (submitted) target, all inserted straight into the test DB. Callers are approved members
 * built through the real endpoints (register, steps, submit, admin approve). A member "with candidates" has every
 * other woman of the shared test DB hidden; a member "without candidates" has every woman hidden.
 * Viewport 360 x 780.
 *
 * MOCKED / BYPASSING cases (everything else is a real server answer):
 *  - "delay only" routes (AC2 skeleton, AC4 busy label, AC8 skeleton, AC10 skeleton, AC10 latest-wins): page.route holds
 *    the request and then continues it unchanged; the answer is real.
 *  - AC4/AC12 tampered cursor: page.route rewrites the `cursor` query value of the real "Load more" request and forwards
 *    it, so the real server answers 400 INVALID_CURSOR (bypass: the UI never sends a bad cursor by itself).
 *  - AC4 dedupe: page.route fetches the real page 2 and adds a copy of a page 1 item to it (mocked body).
 *  - AC6 failed first page: page.route answers the search with a crafted 500 (mock); a second case aborts the request.
 *  - AC10/AC12 PROFILE_NOT_APPROVED: the member's status is moved to `submitted` in the test DB (stands in for the admin
 *    action); the 403 is real. In the AC12 case GET /profiles/me is aborted by page.route afterwards so the stale tab
 *    stays on the page and the sentence can be read (bypass of the redirect); the AC10 case has no route at all.
 *  - AC12 PROFILE_NOT_FOUND: nothing mocked or bypassed.
 */
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import AxeBuilder from '../../../AdminPanel/node_modules/@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  FRIENDLY_BAD, SENTENCES, ageOf, dataset, memberAt, memberWithCandidates, memberWithoutCandidates, moveToSubmitted,
  noHorizontalScroll, ownProfileUid, signIn, withinWidth, type Dataset, type Member, type Seed,
} from './support6b';

const ART = path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-6b');
mkdirSync(ART, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${ART}/${name}.png`, fullPage: true });

const SEARCH = '**/discovery/search**';
const RECS = '**/discovery/recommendations';
const CORS = { 'access-control-allow-origin': '*' };

async function openAs(page: Page, m: Member, url: string) {
  await signIn(page, m);
  await page.goto(url);
}
const resultCards = (page: Page) => page.getByTestId('results-list').getByTestId('profile-card');
const recCards = (page: Page) => page.getByTestId('recommendations-list').getByTestId('profile-card');
const hrefs = (cards: Locator) => cards.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));

function gate() {
  let release: () => void = () => {};
  const wait = new Promise<void>((r) => { release = r; });
  return { wait, release };
}

async function friendly(page: Page, testId: string, expected: string) {
  await expect(page.getByTestId(testId)).toBeVisible();
  const text = (await page.getByTestId(`${testId}-text`).innerText()).trim();
  for (const re of FRIENDLY_BAD) expect(text, `must not match ${re}`).not.toMatch(re);
  expect(text).toBe(expected);
  return text;
}

async function seriousViolations(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}:${v.impact}:${v.nodes.length}:${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

/** No contact data and no internal id inside `scope` (AC7). */
async function contactAudit(scope: Locator, d: Dataset, own: Member) {
  await expect(scope.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
  const text = await scope.innerText();
  expect(text).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  expect(text).not.toMatch(/(?<!\d)\d{10}(?!\d)/);
  expect(text).not.toMatch(/e-?mail|mobile|phone|date of birth/i);
  const html = await scope.evaluate((el) => el.outerHTML);
  for (const s of d.all) {
    for (const secret of [s.userId, s.email, s.mobile, s.profileUid, s.lastName]) expect(html).not.toContain(secret);
  }
  expect(html).not.toContain(own.userId);
  expect(html).not.toContain('profileUid');
}

async function tamperCursor(page: Page) {
  await page.route(SEARCH, async (route: Route) => {
    const u = new URL(route.request().url());
    if (!u.searchParams.has('cursor')) return route.continue();
    u.searchParams.set('cursor', 'tampered-cursor-value');
    return route.continue({ url: u.toString() });
  });
}

// ------------------------------------------------------------------ AC2
test.describe('AC2 recommendations', () => {
  test('AC2 member with candidates: heading, at most 9 cards, each a profileRef link', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    const resp = page.waitForResponse((r) => r.url().endsWith('/discovery/recommendations'));
    await openAs(page, m, '/app');
    const r = await resp;
    expect(r.status()).toBe(200);
    const served = (await r.json()).items.length;
    await expect(page.getByRole('heading', { level: 2, name: "Today's recommendations" })).toBeVisible();
    await expect(recCards(page)).toHaveCount(Math.min(served, 9));
    const n = await recCards(page).count();
    console.log(`AC2 recommendations served=${served} rendered=${n}`);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(9);
    const known = new Set(d.all.map((s) => `/profile/${s.profileRef}`));
    for (const h of await hrefs(recCards(page))) expect(known.has(h), h).toBe(true);
    await expect(page.getByTestId('recommendations-empty')).toHaveCount(0);
    await shot(page, 'ac2-recommendations');
  });

  test('AC2 skeleton cards while loading (aria-busy and hidden "Loading profiles" status); delay only', async ({ page }) => {
    const { m } = await memberWithCandidates();
    const g = gate();
    await page.route(RECS, async (route) => { await g.wait; await route.continue(); });
    await openAs(page, m, '/app');
    const busy = page.getByTestId('recommendations-loading');
    await expect(busy).toBeVisible();
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(busy.getByRole('status')).toHaveText('Loading profiles');
    expect(await busy.getByRole('status').evaluate((el) => el.classList.contains('sr-only'))).toBe(true);
    expect(await busy.getByTestId('card-skeleton').count()).toBeGreaterThan(0);
    await shot(page, 'ac2-skeleton');
    g.release();
    await expect(recCards(page).first()).toBeVisible();
    await expect(busy).toHaveCount(0);
  });

  test('AC2 member with no candidates: exact empty sentence', async ({ page }) => {
    const m = await memberWithoutCandidates();
    await openAs(page, m, '/app');
    await expect(page.getByTestId('recommendations-empty')).toHaveText(SENTENCES.recsEmpty);
    await expect(page.getByTestId('recommendations-list')).toHaveCount(0);
    await shot(page, 'ac2-empty');
  });

  test('AC2 edge: a recommendations failure shows a friendly sentence and Try again recovers (mocked 500)', async ({ page }) => {
    const { m } = await memberWithCandidates();
    await page.route(RECS, (route) => route.fulfill({
      status: 500, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'TypeError: boom {x}', requestId: 'req-recs' }),
    }));
    await openAs(page, m, '/app');
    await expect(page.getByTestId('recommendations-error')).toBeVisible();
    const text = (await page.getByTestId('recommendations-error-text').innerText()).trim();
    for (const re of FRIENDLY_BAD) expect(text).not.toMatch(re);
    expect(text).not.toContain('boom');
    await page.unroute(RECS);
    await page.getByRole('region', { name: "Today's recommendations" }).getByRole('button', { name: 'Try again' }).click();
    await expect(recCards(page).first()).toBeVisible();
    await expect(page.getByTestId('recommendations-error')).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ AC3
test.describe('AC3 search form', () => {
  test('AC3 exactly six filter controls plus Search and Clear filters; no advanced control anywhere', async ({ page }) => {
    const { m } = await memberWithCandidates();
    await openAs(page, m, '/app');
    const form = page.getByRole('form', { name: 'Search filters' });
    await expect(form).toBeVisible();
    await expect(form.locator('input, select, textarea')).toHaveCount(6);
    for (const name of ['Marital status', 'Diet']) await expect(form.getByRole('combobox', { name, exact: true })).toBeVisible();
    for (const name of ['Religion', 'Community', 'State', 'City']) await expect(form.getByRole('textbox', { name, exact: true })).toBeVisible();
    await expect(form.getByRole('button')).toHaveCount(2);
    await expect(form.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Clear filters', exact: true })).toBeVisible();
    expect(await form.getByRole('combobox', { name: 'Marital status' }).locator('option').allTextContents())
      .toEqual(['Any', 'Never Married', 'Widowed', 'Divorced', 'Awaiting Divorce']);
    expect(await form.getByRole('combobox', { name: 'Diet' }).locator('option').allTextContents())
      .toEqual(['Any', 'Vegetarian', 'Non-Vegetarian', 'Eggetarian']);
    const described = await page.locator('input, select, textarea').evaluateAll((els) => els.map((el) => {
      const e = el as HTMLInputElement;
      const labels = Array.from(e.labels ?? []).map((l) => l.textContent ?? '').join(' ');
      return `${e.name} ${e.id} ${e.getAttribute('placeholder') ?? ''} ${e.getAttribute('aria-label') ?? ''} ${labels}`;
    }));
    expect(described).toHaveLength(6);
    for (const dsc of described) expect(dsc).not.toMatch(/age|height|income|education|occupation|profession|profile ?(id|uid)|uid/i);
  });

  test('AC3 submit sends only the non-empty, trimmed filters and keeps them in the page URL', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, '/app');
    await expect(resultCards(page).first()).toBeVisible();
    await page.getByLabel('City').fill(`  ${d.cityRich}  `);
    await page.getByLabel('Religion').fill('   ');
    await page.getByLabel('Diet').selectOption('vegetarian');
    const reqP = page.waitForRequest((r) => r.url().includes('/discovery/search') && r.url().includes('city='));
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const sent = new URL((await reqP).url());
    console.log(`AC3 captured request: ${sent.pathname}${sent.search}`);
    expect([...sent.searchParams.keys()].sort()).toEqual(['city', 'diet', 'limit']);
    expect(sent.searchParams.get('city')).toBe(d.cityRich);
    expect(sent.searchParams.get('diet')).toBe('vegetarian');
    expect(sent.searchParams.get('limit')).toBe('20');
    await expect(resultCards(page)).toHaveCount(1);
    const here = new URL(page.url());
    expect(here.pathname).toBe('/app');
    expect([...here.searchParams.keys()].sort()).toEqual(['city', 'diet']);
    expect(here.searchParams.get('city')).toBe(d.cityRich);
  });

  test('AC3 returning from a profile detail restores the filters (link and browser Back)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}&maritalStatus=neverMarried`);
    await expect(page.getByTestId('results-empty')).toBeVisible(); // seeded page has no marital status
    await page.goto(`/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await resultCards(page).first().locator('a').click();
    await expect(page).toHaveURL(new RegExp(`/profile/${d.page[0].profileRef}$`));
    await expect(page.getByTestId('profile-detail')).toBeVisible();
    await page.getByRole('link', { name: 'Back to results' }).click();
    await expect(page).toHaveURL(new RegExp(`/app\\?city=${d.tag}$`));
    await expect(page.getByLabel('City')).toHaveValue(d.tag);
    await expect(resultCards(page)).toHaveCount(20);
    await resultCards(page).first().locator('a').click();
    await expect(page.getByTestId('profile-detail')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/app\\?city=${d.tag}$`));
    await expect(page.getByLabel('City')).toHaveValue(d.tag);
  });

  test('AC3 edge: a hand-edited URL with unknown and invalid filters never reaches the server', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    const reqP = page.waitForRequest((r) => r.url().includes('/discovery/search'));
    await openAs(page, m, `/app?city=${d.tag}&ageMin=20&profileUid=X1&diet=pizza&heightMax=190`);
    const sent = new URL((await reqP).url());
    expect([...sent.searchParams.keys()].sort()).toEqual(['city', 'limit']);
    await expect(resultCards(page)).toHaveCount(20);
  });
});

// ------------------------------------------------------------------ AC4
test.describe('AC4 cursor pagination', () => {
  test('AC4 20 at a time, busy label, append without duplicates, button gone on the last page', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    const more = page.getByRole('button', { name: 'Load more', exact: true });
    await expect(more).toBeVisible();
    const g = gate();
    await page.route(SEARCH, async (route) => { // delay only
      if (new URL(route.request().url()).searchParams.has('cursor')) await g.wait;
      await route.continue();
    });
    const reqP = page.waitForRequest((r) => r.url().includes('cursor='));
    await more.click();
    const busy = page.getByRole('button', { name: 'Loading more...' });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    const sent = new URL((await reqP).url());
    expect(sent.searchParams.get('limit')).toBe('20');
    expect(sent.searchParams.get('city')).toBe(d.tag);
    g.release();
    await expect(resultCards(page)).toHaveCount(40);
    await page.unroute(SEARCH);
    await expect(more).toBeVisible();
    await more.click();
    await expect(resultCards(page)).toHaveCount(45);
    await expect(page.getByRole('button', { name: /load(ing)? more/i })).toHaveCount(0);
    const all = await hrefs(resultCards(page));
    expect(new Set(all).size).toBe(45);
    expect(all).toEqual(d.page.map((s) => `/profile/${s.profileRef}`)); // newest first, nothing skipped
  });

  test('AC4 a page that repeats an already shown profile is not rendered twice (mocked page 2 body)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    let firstItem: unknown = null;
    await page.route(SEARCH, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (!new URL(route.request().url()).searchParams.has('cursor')) firstItem = body.items[0];
      else body.items.unshift(firstItem);
      await route.fulfill({ response, json: body });
    });
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    const resp = page.waitForResponse((r) => r.url().includes('cursor='));
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    expect((await (await resp).json()).items).toHaveLength(21);
    await expect(resultCards(page)).toHaveCount(40);
    expect(new Set(await hrefs(resultCards(page))).size).toBe(40);
  });

  test('AC4 tampered cursor: friendly INVALID_CURSOR sentence and "Start the search again" reloads page one', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await tamperCursor(page);
    const resp = page.waitForResponse((r) => r.url().includes('cursor='));
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    const r = await resp;
    expect(r.status()).toBe(400);
    expect((await r.json()).code).toBe('INVALID_CURSOR');
    await friendly(page, 'search-error', SENTENCES.invalidCursor);
    const restart = page.getByRole('button', { name: 'Start the search again' });
    await expect(restart).toBeVisible();
    await shot(page, 'ac4-invalid-cursor');
    await page.unroute(SEARCH);
    const first = page.waitForRequest((q) => q.url().includes('/discovery/search') && !q.url().includes('cursor='));
    await restart.click();
    await first;
    await expect(page.getByTestId('search-error')).toHaveCount(0);
    await expect(restart).toHaveCount(0);
    await expect(resultCards(page)).toHaveCount(20);
    expect(await hrefs(resultCards(page))).toEqual(d.page.slice(0, 20).map((s) => `/profile/${s.profileRef}`));
    await expect(page.getByRole('button', { name: 'Load more', exact: true })).toBeVisible();
  });
});

// ------------------------------------------------------------------ AC5
test.describe('AC5 no profile-ID search', () => {
  async function tour(page: Page, m: Member, d: Dataset) {
    const urls: string[] = [];
    const bodies: Array<Promise<{ url: string; text: string }>> = [];
    const doms: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    page.on('response', (r) => {
      if (r.url().includes(':3101/') && r.request().method() !== 'OPTIONS') {
        bodies.push(r.text().then((text) => ({ url: r.url(), text })).catch(() => ({ url: r.url(), text: '' })));
      }
    });
    const snap = async () => { doms.push(await page.content()); urls.push(page.url()); };
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await snap();
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    await expect(resultCards(page)).toHaveCount(40);
    await snap();
    await resultCards(page).first().locator('a').click();
    await expect(page.getByTestId('profile-detail')).toBeVisible();
    await snap();
    await page.getByRole('link', { name: 'Back to results' }).click();
    await expect(resultCards(page)).toHaveCount(20);
    await page.getByRole('button', { name: 'My Profile' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'My Profile' })).toBeVisible();
    await snap();
    await page.waitForLoadState('networkidle');
    return { urls, bodies: await Promise.all(bodies), doms };
  }

  test('AC5 no profile-ID input; profileUid in no URL, no DOM and no discovery response', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    const own = await ownProfileUid(m.userId);
    const { urls, bodies, doms } = await tour(page, m, d);
    const uidValues = [...d.all.map((s) => s.profileUid), ...(own ? [own] : [])];
    for (const u of urls) {
      expect(u).not.toMatch(/profileUid/i);
      for (const v of uidValues) expect(u).not.toContain(v);
    }
    for (const dom of doms) {
      expect(dom).not.toMatch(/profileUid/i);
      expect(dom).not.toMatch(/profile ?id|search by/i);
      for (const v of uidValues) expect(dom).not.toContain(v);
    }
    const discovery = bodies.filter((b) => /\/discovery\/|\/profiles\/[0-9a-f]{32}/.test(b.url));
    expect(discovery.length).toBeGreaterThanOrEqual(4);
    for (const b of discovery) {
      expect(b.text, b.url).not.toMatch(/profileUid/i);
      for (const v of uidValues) expect(b.text, b.url).not.toContain(v);
    }
  });

  test('AC5 profileUid appears in NO member-facing response at all (includes GET /profiles/me)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    const { bodies } = await tour(page, m, d);
    const leaking = bodies.filter((b) => /profileUid/i.test(b.text)).map((b) => new URL(b.url).pathname);
    console.log(`AC5 responses carrying "profileUid": ${JSON.stringify([...new Set(leaking)])}`);
    expect([...new Set(leaking)]).toEqual([]);
  });

  test('AC5 edge: typing a real profile UID into a filter finds nobody', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, '/app');
    await expect(resultCards(page).first()).toBeVisible();
    for (const label of ['City', 'Religion', 'Community', 'State']) {
      await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
      await page.getByLabel(label).fill(d.rich.profileUid);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.getByTestId('results-empty')).toBeVisible();
    }
  });
});

// ------------------------------------------------------------------ AC6
test.describe('AC6 empty and error states', () => {
  test('AC6 no results: exact sentence with a Clear filters button that clears', async ({ page }) => {
    const { m } = await memberWithCandidates();
    await openAs(page, m, '/app?city=NoSuchCityZz');
    const empty = page.getByTestId('results-empty');
    await expect(empty.locator('p')).toHaveText(SENTENCES.resultsEmpty);
    await shot(page, 'ac6-empty');
    await empty.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByLabel('City')).toHaveValue('');
    await expect(resultCards(page).first()).toBeVisible();
  });

  test('AC6 failed first page (mocked 500): friendly sentence, Try again, form stays usable', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await page.route(SEARCH, (route) => route.fulfill({
      status: 500, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Error: relation "x" does not exist {500}', requestId: 'req-6b' }),
    }));
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(page.getByTestId('search-error')).toBeVisible();
    const text = (await page.getByTestId('search-error-text').innerText()).trim();
    console.log(`AC6 first-page failure sentence: ${text}`);
    for (const re of FRIENDLY_BAD) expect(text).not.toMatch(re);
    expect(text).not.toMatch(/relation|INTERNAL/);
    const section = page.getByRole('region', { name: 'Search profiles' });
    const retry = section.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeVisible();
    await expect(page.getByTestId('results-list')).toHaveCount(0);
    await expect(page.getByTestId('results-empty')).toHaveCount(0);
    for (const label of ['Marital status', 'Diet', 'Religion', 'Community', 'State', 'City']) await expect(page.getByLabel(label, { exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeEnabled();
    await shot(page, 'ac6-first-page-error');
    await page.unroute(SEARCH);
    await retry.click();
    await expect(resultCards(page)).toHaveCount(20);
    await expect(page.getByTestId('search-error')).toHaveCount(0);
    await expect(retry).toHaveCount(0);
  });

  test('AC6 edge: network failure on the first page (aborted request) is friendly too and the form can search again', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await page.route(SEARCH, (route) => route.abort());
    await openAs(page, m, '/app');
    await expect(page.getByTestId('search-error')).toBeVisible();
    const text = (await page.getByTestId('search-error-text').innerText()).trim();
    for (const re of FRIENDLY_BAD) expect(text).not.toMatch(re);
    expect(text).not.toMatch(/fetch|NetworkError|TypeError/i);
    await page.unroute(SEARCH);
    await page.getByLabel('City').fill(d.cityRich);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(resultCards(page)).toHaveCount(1);
    await expect(page.getByTestId('search-error')).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ AC7
test.describe('AC7 card content', () => {
  test('AC7 a card shows only first name, age, verified badge, city, religion, community, profession', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    const lines = async (card: Locator) => (await card.innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
    const age = `${ageOf()} years`;
    expect(await lines(resultCards(page).nth(0))).toEqual(['Asha', age, 'Verified', d.tag, 'Jain | Dhobi', 'Engineer']);
    const second: Seed = d.page[1]; // Devi43: odd index, not verified, no photo
    expect(await lines(resultCards(page).nth(1))).toEqual([second.firstName, age, d.tag, 'Jain | Dhobi', 'Engineer']);
    expect(await hrefs(resultCards(page))).toEqual(d.page.slice(0, 20).map((s) => `/profile/${s.profileRef}`));
    await expect(resultCards(page).locator('button, input, select')).toHaveCount(0);
    await shot(page, 'ac7-cards');
  });

  test('AC7 no contact data, no contact label, no internal id on cards (results and recommendations)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await expect(recCards(page).first()).toBeVisible();
    await contactAudit(page.getByTestId('results-list'), d, m);
    await contactAudit(page.getByTestId('recommendations-list'), d, m);
    await contactAudit(page.getByRole('region', { name: 'Search profiles' }), d, m);
  });

  test('AC7 missing photo: placeholder with an alternative text, never another image', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    const card = resultCards(page).nth(1);
    await expect(card.getByRole('img', { name: `${d.page[1].firstName} has not added a photo yet` })).toBeVisible();
    await expect(card.locator('img')).toHaveCount(0);
    await expect(page.getByTestId('results-list').locator('img')).toHaveCount(0);
  });

  test('AC7 edge: missing values fall back to "Not shared", never to "null" or "undefined"', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.citySparse}`);
    await expect(resultCards(page)).toHaveCount(1);
    const text = await resultCards(page).first().innerText();
    expect(text).toContain('Not shared | Not shared');
    expect(text).not.toMatch(/null|undefined|NaN/);
  });

  // Expected to FAIL on this build: the handoff says cards always render the placeholder because no member endpoint
  // turns photoRef into an image URL. AC7 lists "the primary photo" among the card fields.
  test('AC7 primary photo: a card whose response carries a photoRef shows the photo', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    const resp = page.waitForResponse((r) => r.url().includes('/discovery/search'));
    await openAs(page, m, `/app?city=${d.tag}`);
    const first = (await (await resp).json()).items[0];
    expect(first.photoRef).toBe(d.page[0].photoId); // the server does send the approved primary photo reference
    await expect(resultCards(page)).toHaveCount(20);
    const card = resultCards(page).nth(0);
    console.log(`AC7 photo card accessible images: ${JSON.stringify(await card.getByRole('img').evaluateAll((els) => els.map((e) => `${e.tagName}:${e.getAttribute('aria-label') ?? e.getAttribute('alt')}`)))}`);
    await expect(card.locator('img')).toHaveCount(1);
  });
});

// ------------------------------------------------------------------ AC8
test.describe('AC8 profile detail page', () => {
  test('AC8 skeleton, every detail field, first-name-only title, Back to results keeps the filters, no contact field', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.cityRich}`);
    await expect(resultCards(page)).toHaveCount(1);
    const g = gate();
    await page.route(`**/profiles/${d.rich.profileRef}`, async (route) => { await g.wait; await route.continue(); }); // delay only
    const resp = page.waitForResponse((r) => r.url().endsWith(`/profiles/${d.rich.profileRef}`));
    await resultCards(page).first().locator('a').click();
    await expect(page).toHaveURL(new RegExp(`/profile/${d.rich.profileRef}$`));
    const skeleton = page.getByTestId('detail-skeleton');
    await expect(skeleton).toBeVisible();
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
    await expect(skeleton.getByRole('status')).toHaveText('Loading profile');
    g.release();
    const body = await (await resp).json();
    const detail = page.getByTestId('profile-detail');
    await expect(detail).toBeVisible();
    await expect(skeleton).toHaveCount(0);
    expect(Object.keys(body).sort()).toEqual([
      'aboutMyself', 'age', 'city', 'community', 'country', 'diet', 'education', 'employmentType', 'familyStatus', 'firstName',
      'heightCm', 'lookingFor', 'maritalStatus', 'photoRef', 'profession', 'profileRef', 'religion', 'spokenLanguages', 'state',
      'subcommunity', 'verified',
    ]);
    await expect(detail.getByRole('heading', { level: 1 })).toHaveText('Meera');
    const text = await detail.innerText();
    console.log(`AC8 detail text: ${text.replace(/\s*\n\s*/g, ' / ')}`);
    for (const value of [
      `${ageOf()} years`, 'Verified', '158 cm', 'Hindi, Gujarati', 'Hindu', 'Rajaka', 'Parit', d.cityRich, 'Maharashtra', 'India',
      'M.Arch', 'Architect', 'Upper Middle Class', 'I enjoy long walks and old films.', 'A kind and steady partner.',
    ]) expect(text, value).toContain(value);
    expect(text).toMatch(/never\s?married/i);
    expect(text).toMatch(/vegetarian/i);
    expect(text).toMatch(/private/i);
    await expect(detail.getByRole('img', { name: 'Meera has not added a photo yet' })).toBeVisible();
    await expect(page).toHaveTitle('Meera | Dhobi Matrimony');
    expect(await page.title()).not.toContain(d.rich.lastName);
    await contactAudit(page.locator('body'), d, m);
    await expect(page.getByText(/contact/i)).toHaveCount(0);
    await shot(page, 'ac8-detail');
    const back = page.getByRole('link', { name: 'Back to results' });
    await expect(back).toHaveAttribute('href', `/app?city=${d.cityRich}`);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/app\\?city=${d.cityRich}$`));
    await expect(page.getByLabel('City')).toHaveValue(d.cityRich);
    await expect(page).not.toHaveTitle(/Meera/);
  });

  test('AC8 edge: sparse profile opened directly shows "Not shared" and Back to results falls back to /app', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/profile/${d.sparse.profileRef}`);
    const detail = page.getByTestId('profile-detail');
    await expect(detail).toBeVisible();
    const text = await detail.innerText();
    expect(text).not.toMatch(/\bnull\b|undefined|NaN/);
    expect((text.match(/Not shared/g) ?? []).length).toBeGreaterThanOrEqual(8);
    await expect(page.getByRole('link', { name: 'Back to results' })).toHaveAttribute('href', '/app');
  });

  test('AC8 route is for approved members only: submitted -> /pending, draft -> /register, signed out -> /login', async ({ page, browser }) => {
    const d = await dataset();
    const detailCalls: string[] = [];
    for (const [status, target] of [['submitted', /\/pending$/], ['draft', /\/register$/]] as const) {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, baseURL: 'http://localhost:5190' });
      const p = await ctx.newPage();
      p.on('request', (r) => { if (r.url().includes(`/profiles/${d.rich.profileRef}`)) detailCalls.push(`${status}:${r.url()}`); });
      const m = await memberAt(status);
      await openAs(p, m, `/profile/${d.rich.profileRef}`);
      await expect(p).toHaveURL(target);
      await expect(p.getByTestId('profile-detail')).toHaveCount(0);
      await ctx.close();
    }
    await page.goto(`/profile/${d.rich.profileRef}`);
    await expect(page).toHaveURL(/\/login$/);
    expect(detailCalls).toEqual([]);
  });
});

// ------------------------------------------------------------------ AC9
test.describe('AC9 friendly not-found page', () => {
  test('AC9 unknown, non-approved and hidden targets render identical visible text with a Back to search button', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await signIn(page, m);
    const seen: Record<string, { text: string; title: string; status: number; code: string }> = {};
    for (const [label, ref] of [['unknown', d.unknownRef], ['nonApproved', d.nonApproved.profileRef], ['hidden', d.hidden.profileRef]] as const) {
      const resp = page.waitForResponse((r) => r.url().endsWith(`/profiles/${ref}`));
      await page.goto(`/profile/${ref}`);
      const r = await resp;
      const box = page.getByTestId('profile-not-found');
      await expect(box).toBeVisible();
      await expect(box.locator('p')).toHaveText(SENTENCES.notFound);
      await expect(box.getByRole('button', { name: 'Back to search' })).toBeVisible();
      await expect(page.getByTestId('profile-detail')).toHaveCount(0);
      seen[label] = { text: (await page.locator('body').innerText()).trim(), title: await page.title(), status: r.status(), code: (await r.json()).code };
      await shot(page, `ac9-${label}`);
    }
    console.log(`AC9 visible text per case: ${JSON.stringify(seen)}`);
    for (const v of Object.values(seen)) {
      expect(v.status).toBe(404);
      expect(v.code).toBe('PROFILE_NOT_FOUND');
    }
    expect(seen.nonApproved.text).toBe(seen.unknown.text);
    expect(seen.hidden.text).toBe(seen.unknown.text);
    expect(seen.nonApproved.title).toBe(seen.unknown.title);
    expect(seen.hidden.title).toBe(seen.unknown.title);
    expect(seen.unknown.text).not.toMatch(/hidden|approved|review|exist|removed|blocked|Hidya|Pendya/i);
    await page.getByRole('button', { name: 'Back to search' }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test('AC9 edge: malformed reference and own-gender profile look the same as unknown', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await signIn(page, m);
    const texts: string[] = [];
    for (const ref of [d.unknownRef, 'not-a-ref', '%3Cscript%3E']) {
      await page.goto(`/profile/${ref}`);
      await expect(page.getByTestId('profile-not-found')).toBeVisible();
      texts.push((await page.locator('body').innerText()).trim());
    }
    expect(new Set(texts).size).toBe(1);
  });
});

// ------------------------------------------------------------------ AC10
test.describe('AC10 loading and robustness', () => {
  test('AC10 delayed search shows skeleton cards, then the results (delay only)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    const g = gate();
    await page.route(SEARCH, async (route) => { await g.wait; await route.continue(); });
    await openAs(page, m, `/app?city=${d.tag}`);
    const busy = page.getByTestId('results-loading');
    await expect(busy).toBeVisible();
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(busy.getByRole('status')).toHaveText('Loading profiles');
    await expect(busy.getByTestId('card-skeleton')).toHaveCount(6);
    await expect(page.getByTestId('results-list')).toHaveCount(0);
    await shot(page, 'ac10-skeleton');
    g.release();
    await expect(resultCards(page)).toHaveCount(20);
    await expect(busy).toHaveCount(0);
  });

  test('AC10 PROFILE_NOT_APPROVED mid-session refreshes the profile and redirects by status (real 403, nothing routed)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await moveToSubmitted(m.userId);
    const resp = page.waitForResponse((r) => r.url().includes('/discovery/search'));
    const me = page.waitForResponse((r) => r.url().endsWith('/profiles/me'));
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const r = await resp;
    expect(r.status()).toBe(403);
    expect((await r.json()).code).toBe('PROFILE_NOT_APPROVED');
    expect((await me).status()).toBe(200);
    await expect(page).toHaveURL(/\/pending$/);
    await expect(page.getByTestId('pending-submitted-text')).toBeVisible();
  });

  test('AC10 PROFILE_NOT_APPROVED on the detail page also redirects (real 403)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.cityRich}`);
    await expect(resultCards(page)).toHaveCount(1);
    await moveToSubmitted(m.userId);
    await resultCards(page).first().locator('a').click();
    await expect(page).toHaveURL(/\/pending$/);
  });

  test('AC10 latest search wins: an earlier, slower answer never overwrites it (delay only)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, '/app');
    await expect(resultCards(page).first()).toBeVisible();
    const g = gate();
    await page.route(SEARCH, async (route) => {
      if (new URL(route.request().url()).searchParams.get('city') === d.citySlow) await g.wait;
      await route.continue();
    });
    const slowDone = page.waitForResponse((r) => r.url().includes(`city=${d.citySlow}`));
    await page.getByLabel('City').fill(d.citySlow);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByTestId('results-loading')).toBeVisible();
    await page.getByLabel('City').fill(d.cityRich);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(resultCards(page)).toHaveCount(1);
    await expect(resultCards(page).first()).toContainText('Meera');
    g.release();
    const slow = await slowDone;
    expect(slow.status()).toBe(200);
    expect((await slow.json()).items[0].firstName).toBe('Slowona');
    await page.waitForLoadState('networkidle');
    await expect(resultCards(page)).toHaveCount(1);
    await expect(resultCards(page).first()).toContainText('Meera');
    await expect(page.getByText('Slowona')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`city=${d.cityRich}$`));
  });
});

// ------------------------------------------------------------------ AC12
test.describe('AC12 friendly server errors end to end', () => {
  test('AC12 INVALID_CURSOR (real 400; page.route forwards a tampered cursor)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await tamperCursor(page);
    const resp = page.waitForResponse((r) => r.url().includes('cursor='));
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    const r = await resp;
    console.log(`AC12 INVALID_CURSOR server answer: ${r.status()} ${await r.text()}`);
    expect(r.status()).toBe(400);
    expect((await r.json()).code).toBe('INVALID_CURSOR');
    const text = await friendly(page, 'search-error', SENTENCES.invalidCursor);
    console.log(`AC12 INVALID_CURSOR visible: ${text}`);
    await shot(page, 'ac12-invalid-cursor');
  });

  test('AC12 PROFILE_NOT_FOUND (real 404 from an unknown reference; nothing mocked)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    const resp = page.waitForResponse((r) => r.url().endsWith(`/profiles/${d.unknownRef}`));
    await openAs(page, m, `/profile/${d.unknownRef}`);
    const r = await resp;
    console.log(`AC12 PROFILE_NOT_FOUND server answer: ${r.status()} ${await r.text()}`);
    expect(r.status()).toBe(404);
    expect((await r.json()).code).toBe('PROFILE_NOT_FOUND');
    const text = (await page.getByTestId('profile-not-found').locator('p').innerText()).trim();
    console.log(`AC12 PROFILE_NOT_FOUND visible: ${text}`);
    expect(text).toBe(SENTENCES.notFound);
    for (const re of FRIENDLY_BAD) expect(text).not.toMatch(re);
    const whole = (await page.locator('main').innerText()).trim();
    for (const re of [FRIENDLY_BAD[0], FRIENDLY_BAD[1], FRIENDLY_BAD[3]]) expect(whole).not.toMatch(re);
    await shot(page, 'ac12-not-found');
  });

  test('AC12 PROFILE_NOT_APPROVED (real 403 in a stale session; /profiles/me aborted so the tab stays put)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await moveToSubmitted(m.userId);
    await page.route('**/profiles/me', (route) => route.abort());
    const resp = page.waitForResponse((r) => r.url().includes('/discovery/search'));
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const r = await resp;
    console.log(`AC12 PROFILE_NOT_APPROVED server answer: ${r.status()} ${await r.text()}`);
    expect(r.status()).toBe(403);
    expect((await r.json()).code).toBe('PROFILE_NOT_APPROVED');
    const text = await friendly(page, 'search-error', SENTENCES.notApproved);
    console.log(`AC12 PROFILE_NOT_APPROVED visible: ${text}`);
    await expect(page.getByTestId('results-list')).toHaveCount(0);
    await shot(page, 'ac12-not-approved');
  });
});

// ------------------------------------------------------------------ AC14 + AC15
test.describe('AC14 responsive at 360 px and AC15 axe', () => {
  test('AC14/15 AppPage with recommendations and results', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await expect(recCards(page).first()).toBeVisible();
    expect(await page.evaluate(() => window.innerWidth)).toBe(360);
    expect(await noHorizontalScroll(page)).toBe(true);
    for (const name of ['Search', 'Clear filters', 'Load more']) {
      expect(await withinWidth(page, page.getByRole('button', { name, exact: true })), name).toBe(true);
    }
    for (const name of ['Matches', 'My Profile', 'Sign out']) expect(await withinWidth(page, page.getByRole('button', { name, exact: true })), name).toBe(true);
    for (const label of ['Marital status', 'Diet', 'Religion', 'Community', 'State', 'City']) expect(await withinWidth(page, page.getByLabel(label, { exact: true })), label).toBe(true);
    expect(await withinWidth(page, resultCards(page).first().locator('a'))).toBe(true);
    expect(await noHorizontalScroll(page)).toBe(true);
    await shot(page, 'ac14-app-results');
    expect(await seriousViolations(page), 'axe AppPage results').toEqual([]);
  });

  test('AC14/15 AppPage with both empty states (no recommendations, no results)', async ({ page }) => {
    const m = await memberWithoutCandidates();
    await openAs(page, m, '/app?city=NoSuchCityZz');
    await expect(page.getByTestId('recommendations-empty')).toBeVisible();
    await expect(page.getByTestId('results-empty')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByTestId('results-empty').getByRole('button', { name: 'Clear filters' }))).toBe(true);
    await shot(page, 'ac14-app-empty');
    expect(await seriousViolations(page), 'axe AppPage empty').toEqual([]);
  });

  test('AC14/15 AppPage with the search error and its action', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await tamperCursor(page);
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    await expect(page.getByTestId('search-error')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByRole('button', { name: 'Start the search again' }))).toBe(true);
    await shot(page, 'ac14-app-error');
    expect(await seriousViolations(page), 'axe AppPage error').toEqual([]);
  });

  test('AC14/15 loading skeletons', async ({ page }) => {
    const { m } = await memberWithCandidates();
    const g = gate();
    await page.route(SEARCH, async (route) => { await g.wait; await route.continue(); });
    await page.route(RECS, async (route) => { await g.wait; await route.continue(); });
    await openAs(page, m, '/app');
    await expect(page.getByTestId('results-loading')).toBeVisible();
    await expect(page.getByTestId('recommendations-loading')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await seriousViolations(page), 'axe AppPage loading').toEqual([]);
    g.release();
  });

  test('AC14/15 profile detail page', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/profile/${d.rich.profileRef}`);
    await expect(page.getByTestId('profile-detail')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByRole('link', { name: 'Back to results' }))).toBe(true);
    await shot(page, 'ac14-detail');
    expect(await seriousViolations(page), 'axe detail').toEqual([]);
  });

  test('AC14/15 not-found page', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/profile/${d.unknownRef}`);
    await expect(page.getByTestId('profile-not-found')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(await withinWidth(page, page.getByRole('button', { name: 'Back to search' }))).toBe(true);
    expect(await withinWidth(page, page.getByRole('link', { name: 'Back to results' }))).toBe(true);
    await shot(page, 'ac14-not-found');
    expect(await seriousViolations(page), 'axe not-found').toEqual([]);
  });

  test('AC14 edge: long unbroken values do not widen the page at 360 px (mocked card and detail bodies)', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    // 150 characters without a space: the longest value the occupation/education columns (varchar 150) can hold.
    const long = 'Supercalifragilisticexpialidocious'.repeat(5).slice(0, 150);
    await page.route(SEARCH, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.items = body.items.map((i: Record<string, unknown>) => ({ ...i, firstName: long, city: long, religion: long, community: long, profession: long }));
      await route.fulfill({ response, json: body });
    });
    await page.route(`**/profiles/${d.rich.profileRef}`, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, firstName: long, education: long, aboutMyself: long, city: long, subcommunity: long } });
    });
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    const app = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    await shot(page, 'ac14-long-cards');
    await page.goto(`/profile/${d.rich.profileRef}`);
    await expect(page.getByTestId('profile-detail')).toBeVisible();
    const det = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    await shot(page, 'ac14-long-detail');
    const widest = await page.evaluate(() => {
      let worst = { tag: '', right: 0, text: '' };
      for (const el of Array.from(document.querySelectorAll('main *'))) {
        const r = el.getBoundingClientRect();
        if (r.right > worst.right) worst = { tag: `${el.tagName}.${(el.getAttribute('class') ?? '').slice(0, 60)}`, right: Math.round(r.right), text: (el.textContent ?? '').slice(0, 20) };
      }
      return worst;
    });
    console.log(`AC14 long values: app ${JSON.stringify(app)} detail ${JSON.stringify(det)} widest detail element ${JSON.stringify(widest)}`);
    expect(app.sw).toBeLessThanOrEqual(app.iw);
    expect(det.sw).toBeLessThanOrEqual(det.iw);
  });

  test('AC15 informational: axe on the My Profile tab of AppPage (content that predates this story)', async ({ page }) => {
    const { m } = await memberWithCandidates();
    await openAs(page, m, '/app');
    await page.getByRole('button', { name: 'My Profile' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'My Profile' })).toBeVisible();
    console.log(`AC15 My Profile tab axe serious/critical: ${JSON.stringify(await seriousViolations(page))}`);
    console.log(`AC7 note, My Profile tab contact labels: ${JSON.stringify((await page.locator('main').innerText()).match(/Mobile[^\n]*|Date of Birth[^\n]*/g))}`);
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

// ------------------------------------------------------------------ AC15 keyboard
test.describe('AC15 keyboard', () => {
  test('AC15 Tab order through the form; Enter in a field and Space on Search submit', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, '/app');
    await expect(resultCards(page).first()).toBeVisible();
    await page.getByRole('combobox', { name: 'Marital status' }).focus();
    const order: Array<[string, string]> = [
      ['combobox', 'Diet'], ['textbox', 'Religion'], ['textbox', 'Community'], ['textbox', 'State'], ['textbox', 'City'],
      ['button', 'Search'], ['button', 'Clear filters'],
    ];
    const form = page.getByRole('form', { name: 'Search filters' });
    for (const [role, name] of order) {
      await page.keyboard.press('Tab');
      await expect(form.getByRole(role as 'button', { name, exact: true })).toBeFocused();
    }
    await page.getByRole('textbox', { name: 'City' }).focus();
    await page.keyboard.type(d.cityRich);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`city=${d.cityRich}$`));
    await expect(resultCards(page)).toHaveCount(1);
    await page.getByRole('textbox', { name: 'City' }).fill(d.citySparse);
    await form.getByRole('button', { name: 'Search', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(new RegExp(`city=${d.citySparse}$`));
    await expect(resultCards(page).first()).toContainText('Nila');
    await form.getByRole('button', { name: 'Clear filters', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('textbox', { name: 'City' })).toHaveValue('');
  });

  test('AC15 cards, Load more, detail links and the not-found button work by keyboard and have accessible names', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    const more = page.getByRole('button', { name: 'Load more', exact: true });
    await more.focus();
    await page.keyboard.press('Space');
    await expect(resultCards(page)).toHaveCount(40);
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(resultCards(page)).toHaveCount(45);
    const link = page.getByTestId('results-list').getByRole('link', { name: 'View profile of Asha', exact: true });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/profile/${d.page[0].profileRef}$`));
    await expect(page.getByTestId('profile-detail')).toBeVisible();
    const back = page.getByRole('link', { name: 'Back to results' });
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/app\\?city=${d.tag}$`));
    await page.goto(`/profile/${d.unknownRef}`);
    const toSearch = page.getByRole('button', { name: 'Back to search' });
    await toSearch.focus();
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(/\/app$/);
    // header controls touched by this story
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dhobi Matrimony home' })).toBeVisible();
    const tab = page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'My Profile' });
    await tab.focus();
    await page.keyboard.press('Enter');
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 2, name: 'My Profile' })).toBeVisible();
  });

  test('AC15 the error actions are reachable and operable by keyboard', async ({ page }) => {
    const { m, d } = await memberWithCandidates();
    await openAs(page, m, `/app?city=${d.tag}`);
    await expect(resultCards(page)).toHaveCount(20);
    await tamperCursor(page);
    await page.getByRole('button', { name: 'Load more', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText(SENTENCES.invalidCursor);
    await page.unroute(SEARCH);
    const restart = page.getByRole('button', { name: 'Start the search again' });
    await restart.focus();
    await page.keyboard.press('Enter');
    await expect(restart).toHaveCount(0);
    await expect(resultCards(page)).toHaveCount(20);
  });
});
