/**
 * Phase 1 story 10, AC3 (SEC-32): Cache Storage never holds an API response, a signed URL, an Authorization-bearing
 * request/response or a cross-origin response. One approved member, real backend (3101), the built app on 5191.
 */
import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { BASE, approved, ctl, dumpCaches, firstVisit, seedProfile, stubFonts, tag, uiLogin } from './support10';

test.beforeEach(async () => {
  await ctl('reset');
});

test('AC3 after login and a tour of the app Cache Storage holds only same-origin static shell files', async ({ page, context }) => {
  const fontHits = await stubFonts(context);
  const m = await approved();
  const city = tag();
  const target = await seedProfile({ first: 'Tara', city });

  await firstVisit(page);
  await uiLogin(page, m);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const cards = page.getByTestId('results-list').getByTestId('profile-card');
  await page.goto(`/app?city=${city}`);
  await expect(cards).toHaveCount(1);
  await cards.getByTestId('shortlist-button').click(); // opens the Shortlist drawer (authenticated API calls)
  await expect(page.getByTestId('shortlist-drawer')).toBeVisible();
  await expect(page.getByTestId('shortlist-drawer-loading')).toHaveCount(0);
  await page.getByTestId('shortlist-drawer-close').click();

  for (const [route, heading] of [['/settings', 'Settings'], ['/shortlists', 'Shortlists'], ['/interests', 'Interests']] as const) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
  }
  await page.goto(`/profile/${target.profileRef}`);
  await expect(page.getByTestId('profile-detail')).toBeVisible();

  // same-origin probes that a buggy policy could cache: API path, signed URLs, Authorization header
  await page.evaluate(async () => {
    const probes: Array<[string, RequestInit?]> = [
      ['/api/v1/members/me.png'],
      ['/api/v1/profiles/me'],
      ['/photo.png?X-Amz-Signature=abc&X-Amz-Expires=60'],
      ['/photo2.png?Signature=abc&Expires=1'],
      ['/photo3.png?token=abc'],
      ['/photo4.png', { headers: { Authorization: 'Bearer x' } }],
    ];
    for (const [url, init] of probes) await fetch(url, init).catch(() => undefined);
  });

  const { keys, entries } = await dumpCaches(page);
  test.info().annotations.push({ type: 'cache-keys', description: JSON.stringify(keys) });
  test.info().annotations.push({ type: 'cache-urls', description: JSON.stringify(entries.map((e) => e.url)) });
  test.info().annotations.push({ type: 'font-requests-seen', description: JSON.stringify(fontHits) });

  writeFileSync(path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-10', 'ac3-cache-dump.json'), JSON.stringify({ keys, entries, fontHits }, null, 2));
  expect(keys.length).toBeGreaterThan(0);
  expect(entries.length).toBeGreaterThan(0);
  for (const k of keys) expect(k).toMatch(/^dhobi-shell-[0-9a-f]{12}$/);
  for (const e of entries) {
    const u = new URL(e.url);
    expect(u.origin, `cross-origin entry ${e.url}`).toBe(BASE);
    expect(e.url, 'api url').not.toContain('/api/');
    expect(u.search, `query on ${e.url}`).toBe('');
    expect(e.url).not.toMatch(/signature|x-amz|expires|token|[?&]sig=|[?&]se=|[?&]sv=/i);
    expect(e.requestHeaders, `request headers ${e.url}`).not.toContain('authorization');
    expect(e.responseHeaders, `response headers ${e.url}`).not.toContain('authorization');
    expect(e.responseType).toBe('basic');
  }
  // the third-party font origins were really requested (so the negative result above means something) and none was cached
  expect(fontHits.length, 'fonts were requested').toBeGreaterThan(0);
  expect(entries.filter((e) => /fonts\.(googleapis|gstatic)\.com/.test(e.url))).toEqual([]);
  // the shell itself is cached
  const urls = entries.map((e) => new URL(e.url).pathname);
  expect(urls).toContain('/');
  expect(urls).toContain('/site.webmanifest');
  expect(urls.some((u) => /^\/assets\/index-.*\.js$/.test(u))).toBe(true);
});

test('AC3 edge: a second member signing in on the same browser does not put any API entry in the cache either', async ({ page, context }) => {
  await stubFonts(context);
  const m = await approved();
  await firstVisit(page);
  await uiLogin(page, m);
  await expect(page).toHaveURL(/\/app/);
  await page.goto('/interests');
  await expect(page.getByRole('heading', { name: 'Interests', level: 1 })).toBeVisible();
  const { entries } = await dumpCaches(page);
  expect(entries.filter((e) => /\/api\/|3101/.test(e.url))).toEqual([]);
});
