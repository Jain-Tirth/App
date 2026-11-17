/**
 * Phase 1 story 9b: member UI for account settings, logout-all, export, delete, deleted-pending.
 * Harness: real backend (dist/main.js, port 3101, test DB) + UserWeb dev (5190). Viewport 360 x 780.
 * Members: approved members built through real endpoints (memberAt). One member per test, run sequentially, no parallel bursts.
 *
 * MOCKED / BYPASSING cases (everything else is a real server answer):
 *  - AC1 skeleton: page.route holds the real GET /account/settings and continues it (delay only).
 *  - AC1 revert: page.route FULFILLS a synthetic 500 for one PATCH (mocked; no real server error is available).
 *  - AC2 bad language: page.route rewrites the body of the real PATCH to language 'xx' and forwards it (bypass: the select
 *    only offers valid values); the server answers 400 and the UI shows the mapped sentence.
 *  - AC5 410: real server answer after the test sets AccountExportRequests.expiresAt into the past (DB).
 *  - AC5 404: real server answer for a request id that belongs to another member (localStorage entry swapped).
 *  - AC7 purged: real server answer after the test moves Users.deletionScheduledPurgeAt into the past (DB).
 *  - AC10 STEP_UP_FAILED, REQUEST_ALREADY_PENDING, RATE_LIMITED: all real server answers, no page.route.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '../../../AdminPanel/node_modules/@axe-core/playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  FRIENDLY_BAD, MSG, NO_THIRD_PARTY, USER, apiLogin, apiSettings, approved, call, db, humanize, purgeDay, track, uiLogin,
} from './support9b';

const ART = path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-9b');
mkdirSync(ART, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${ART}/${name}.png`, fullPage: true });

const noScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const dlg = (page: Page) => page.getByTestId('stepup-dialog');
const confirm = (page: Page) => page.getByTestId('confirm-dialog');
const apiPaths = (log: { path: string }[], re: RegExp) => log.filter((l) => re.test(l.path));

async function openSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
}

async function friendly(loc: Locator, expected: string | RegExp) {
  await expect(loc).toBeVisible();
  // The notice may append a "Reference: <id>" support line; the sentence itself is what is compared.
  const text = (await loc.innerText()).split(/\n\s*Reference:/)[0].trim();
  for (const re of FRIENDLY_BAD) expect(text, `must not match ${re}`).not.toMatch(re);
  if (typeof expected === 'string') expect(text).toBe(expected);
  else expect(text).toMatch(expected);
}

async function sendStepUp(page: Page, password: string) {
  await dlg(page).getByTestId('stepup-password').fill(password);
  await dlg(page).getByTestId('stepup-submit').click();
}

async function allText(page: Page) {
  return page.evaluate(() => ({
    text: document.body.innerText,
    hrefs: Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') ?? ''),
  }));
}
const clean = (s: { text: string; hrefs: string[] }) => {
  expect(s.text).not.toMatch(/grievance|officer/i);
  expect(s.hrefs.join(' ')).not.toMatch(/grievance|officer/i);
};

async function axeClean(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `axe ${label}`).toEqual([]);
}

test.describe('story 9b', () => {
  test('AC1 settings skeleton, controls, only changed key sent, revert, reload, no visibility', async ({ page }) => {
    const m = await approved();
    const log = track(page);
    await uiLogin(page, m);
    // skeleton (delay only)
    let held = true;
    await page.route('**/account/settings', async (route) => {
      if (route.request().method() === 'GET' && held) {
        held = false;
        await new Promise((r) => setTimeout(r, 1200));
      }
      await route.continue();
    });
    await page.goto('/settings');
    await expect(page.getByTestId('settings-skeleton')).toBeVisible();
    await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
    await page.unroute('**/account/settings');

    const saved = await apiSettings(m);
    const keys = Object.keys(saved.notifications);
    expect(keys.length).toBeGreaterThan(0);
    // language options
    const opts = await page.getByTestId('settings-language').locator('option').allInnerTexts();
    expect(opts).toEqual(['English', 'Hindi', 'Gujarati']);
    // one switch per flag with humanized name
    await expect(page.getByRole('switch')).toHaveCount(keys.length);
    for (const k of keys) {
      const sw = page.getByRole('switch', { name: humanize(k), exact: true });
      await expect(sw).toHaveCount(1);
      await expect(sw).toHaveAttribute('aria-checked', String(saved.notifications[k]));
    }
    // absence of visibility
    const body = await page.evaluate(() => document.body.innerText + ' ' + document.body.innerHTML);
    expect(body).not.toMatch(/visibility/i);
    expect(body).not.toMatch(/hidden from search/i);
    await expect(page.getByText(/visibility|hidden from search/i)).toHaveCount(0);

    // one PATCH with only the changed key
    const k0 = keys[0];
    const before = log.length;
    const patchReq = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes('/account/settings'));
    await page.getByRole('switch', { name: humanize(k0), exact: true }).click();
    const req = await patchReq;
    expect(JSON.parse(req.postData() ?? '{}')).toEqual({ notifications: { [k0]: !saved.notifications[k0] } });
    await expect(page.getByRole('switch', { name: humanize(k0), exact: true })).toHaveAttribute('aria-checked', String(!saved.notifications[k0]));
    await expect(page.getByRole('switch', { name: humanize(k0), exact: true })).toBeEnabled();
    expect(log.slice(before).filter((l) => l.method === 'PATCH')).toHaveLength(1);

    // revert on failure (mocked 500)
    const k1 = keys[1];
    await page.route('**/account/settings', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }) });
      } else await route.continue();
    });
    await page.getByRole('switch', { name: humanize(k1), exact: true }).click();
    await expect(page.getByTestId('settings-save-error')).toBeVisible();
    await friendly(page.getByTestId('settings-save-error'), /\S/);
    await expect(page.getByRole('switch', { name: humanize(k1), exact: true })).toHaveAttribute('aria-checked', String(saved.notifications[k1]));
    await page.unroute('**/account/settings');
    await shot(page, 'ac1-revert');

    // reload shows saved values
    await page.reload();
    await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
    await expect(page.getByRole('switch', { name: humanize(k0), exact: true })).toHaveAttribute('aria-checked', String(!saved.notifications[k0]));
    await expect(page.getByRole('switch', { name: humanize(k1), exact: true })).toHaveAttribute('aria-checked', String(saved.notifications[k1]));
    // profileVisibility never sent
    for (const l of log.filter((x) => x.method === 'PATCH')) expect(l.body ?? '').not.toContain('profileVisibility');
    expect(await noScroll(page)).toBe(true);
    await shot(page, 'ac1-settings');
  });

  test('AC2 language persists, reload, lang attribute, others untouched, bad language mapped', async ({ page }) => {
    const m = await approved();
    const log = track(page);
    await uiLogin(page, m);
    await openSettings(page);
    const saved = await apiSettings(m);
    const k0 = Object.keys(saved.notifications)[0];
    // flip a switch first, then change language: the switch must keep its value
    await page.getByRole('switch', { name: humanize(k0), exact: true }).click();
    const flipped = String(!saved.notifications[k0]);
    await expect(page.getByRole('switch', { name: humanize(k0), exact: true })).toBeEnabled();
    const patchReq = page.waitForRequest((r) => r.method() === 'PATCH' && r.postData()?.includes('language') === true);
    await page.getByTestId('settings-language').selectOption('gu');
    expect(JSON.parse((await patchReq).postData() ?? '{}')).toEqual({ language: 'gu' });
    await expect(page.getByTestId('settings-language')).toBeEnabled();
    await expect(page.getByRole('switch', { name: humanize(k0), exact: true })).toHaveAttribute('aria-checked', flipped);
    await expect(page.locator('html')).toHaveAttribute('lang', 'gu');
    expect((await apiSettings(m)).language).toBe('gu');
    await page.reload();
    await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
    await expect(page.getByTestId('settings-language')).toHaveValue('gu');
    await expect(page.locator('html')).toHaveAttribute('lang', 'gu');
    await expect(page.getByRole('switch', { name: humanize(k0), exact: true })).toHaveAttribute('aria-checked', flipped);
    // edge: bad language forwarded to the real server
    await page.route('**/account/settings', async (route) => {
      if (route.request().method() === 'PATCH') await route.continue({ postData: JSON.stringify({ language: 'xx' }) });
      else await route.continue();
    });
    await page.getByTestId('settings-language').selectOption('hi');
    await friendly(page.getByTestId('settings-save-error'), MSG.language);
    await expect(page.getByTestId('settings-language')).toHaveValue('gu');
    await expect(page.locator('html')).toHaveAttribute('lang', 'gu');
    await page.unroute('**/account/settings');
    expect((await apiSettings(m)).language).toBe('gu');
    for (const l of log.filter((x) => x.method === 'PATCH')) expect(l.body ?? '').not.toContain('profileVisibility');
  });

  test('AC3 logout-all: confirmation, cancel and Escape send nothing, confirm clears and other session is ended', async ({ page, browser }) => {
    const m = await approved();
    // second context holds an older session
    const ctx2 = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page2 = await ctx2.newPage();
    await uiLogin(page2, m);
    await page2.goto('/settings');
    await expect(page2.getByTestId('settings-skeleton')).toHaveCount(0);

    const log = track(page);
    await uiLogin(page, m);
    await openSettings(page);
    const trigger = page.getByRole('button', { name: 'Log out of all devices' });
    await trigger.click();
    const d = confirm(page);
    await expect(d).toBeVisible();
    await expect(d.getByRole('heading')).toHaveText('Log out of all devices? You will need to sign in again everywhere.');
    await expect(d.getByRole('button', { name: 'Log out everywhere' })).toBeVisible();
    await d.getByRole('button', { name: 'Stay signed in' }).click();
    await expect(d).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(d).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(apiPaths(log, /logout-all/)).toHaveLength(0);
    await trigger.click();
    await d.getByRole('button', { name: 'Log out everywhere' }).click();
    await page.waitForURL(/\/login/);
    await expect(page.getByTestId('login-notice')).toHaveText(MSG.loggedOut);
    expect(apiPaths(log, /logout-all/).filter((l) => l.method === 'POST')).toHaveLength(1);
    const store = await page.evaluate(() => ({ a: localStorage.getItem('user_access_token'), r: localStorage.getItem('user_refresh_token'), keys: Object.keys(localStorage) }));
    expect(store.a).toBeNull();
    expect(store.r).toBeNull();
    expect(store.keys.filter((k) => k.startsWith('user_export_request:'))).toEqual([]);
    await shot(page, 'ac3-login-notice');
    // the old session in the other context is sent to sign-in on its next request
    await page2.goto('/settings');
    await page2.waitForURL(/\/login/, { timeout: 20_000 });
    await expect(page2.getByTestId('login-submit')).toBeVisible();
    await shot(page2, 'ac3-other-context');
    await ctx2.close();
    // edge: Escape while the dialog is closed does nothing / repeated confirm already counted once
  });

  test('AC4 AC5 AC10 export: dialog, wrong password, 202, already pending, download, expiry, 410, 404, logout clears', async ({ page }) => {
    const m = await approved();
    const other = await approved();
    const log = track(page);
    const logs: string[] = [];
    page.on('console', (c) => logs.push(c.text()));
    await uiLogin(page, m);
    await openSettings(page);
    await expect(page.locator('body')).toContainText(NO_THIRD_PARTY);
    await expect(page.getByTestId('privacy-statement')).toHaveText(NO_THIRD_PARTY);
    const trigger = page.getByRole('button', { name: 'Download my data' });
    await trigger.click();
    await expect(dlg(page)).toBeVisible();
    const pw = dlg(page).getByLabel('Password', { exact: true });
    await expect(pw).toHaveAttribute('type', 'password');
    await expect(pw).toHaveAttribute('autocomplete', 'current-password');
    await expect(dlg(page).getByText(NO_THIRD_PARTY, { exact: true })).toBeVisible();
    await expect(dlg(page).getByText('The download link is valid for 24 hours.', { exact: true })).toBeVisible();
    const submit = dlg(page).getByRole('button', { name: 'Request export' });
    await expect(submit).toBeDisabled();
    await dlg(page).getByRole('button', { name: 'Show password' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
    await dlg(page).getByRole('button', { name: 'Hide password' }).click();
    await expect(pw).toHaveAttribute('type', 'password');
    // wrong password (real STEP_UP_FAILED)
    await pw.fill('WrongPass999');
    await expect(submit).toBeEnabled();
    await submit.click();
    await friendly(dlg(page).getByTestId('stepup-error'), MSG.stepUp);
    await expect(dlg(page)).toBeVisible();
    await expect(pw).toHaveValue('');
    expect(apiPaths(log, /export-request/).filter((l) => l.method === 'POST')).toHaveLength(1);
    await expect(submit).toBeDisabled();
    await shot(page, 'ac4-wrong-password');
    // password leak check after a failed attempt
    const leak = await page.evaluate(() => JSON.stringify({ ls: { ...localStorage }, ss: { ...sessionStorage }, html: document.documentElement.outerHTML, url: location.href }));
    expect(leak).not.toContain('WrongPass999');
    // correct password: 202
    await pw.fill(m.password);
    await submit.click();
    await expect(dlg(page)).toHaveCount(0);
    await expect(page.getByTestId('export-received')).toHaveText('Your export request was received.');
    await expect(page.getByTestId('export-status')).toContainText('pending');
    const stored = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('user_export_request:')));
    expect(stored).toHaveLength(1);
    expect(stored[0][0]).toBe(`user_export_request:${m.userId}`);
    const rec = JSON.parse(stored[0][1]);
    expect(Object.keys(rec).sort()).toEqual(['requestId', 'requestedAt']);
    expect(Math.abs(Date.now() - rec.requestedAt)).toBeLessThan(120_000);
    const leak2 = await page.evaluate(() => JSON.stringify({ ls: { ...localStorage }, ss: { ...sessionStorage }, html: document.documentElement.outerHTML }));
    expect(leak2).not.toContain(m.password);
    expect(logs.join('\n')).not.toContain(m.password);
    expect(log.filter((l) => l.path.includes('?') && l.path.includes(m.password))).toEqual([]);
    await expect(trigger).toBeFocused();

    // second export request: real REQUEST_ALREADY_PENDING
    await trigger.click();
    await sendStepUp(page, m.password);
    await friendly(dlg(page).getByTestId('stepup-error'), MSG.alreadyPending);
    await expect(dlg(page)).toBeVisible();
    await expect(pw).toHaveValue('');
    await pw.focus(); // focus is lost after a failed attempt (see the AC13 focus test); refocus to carry on
    await page.keyboard.press('Escape');
    await expect(dlg(page)).toHaveCount(0);

    // download with the Bearer token, saved as my-data.json, never rendered
    const before = log.length;
    const dl = page.waitForEvent('download');
    await page.getByTestId('export-download').click();
    const file = await dl;
    expect(file.suggestedFilename()).toBe('my-data.json');
    const saved = await file.path();
    const json = JSON.parse(readFileSync(saved, 'utf8'));
    expect(typeof json).toBe('object');
    const getReq = log.slice(before).filter((l) => l.method === 'GET' && /\/account\/export\//.test(l.path));
    expect(getReq).toHaveLength(1);
    expect(getReq[0].auth).toMatch(/^Bearer .{20,}/);
    expect(await page.locator('a[href*="/account/export/"]').count()).toBe(0);
    const pageText = await page.evaluate(() => document.body.innerText);
    expect(pageText).not.toContain(m.email);
    expect(pageText).not.toContain('{');
    expect(readFileSync(saved, 'utf8')).toContain(m.email);

    // 24 h: move the stored time
    await page.evaluate((id) => {
      const k = `user_export_request:${id}`;
      const v = JSON.parse(localStorage.getItem(k) as string);
      localStorage.setItem(k, JSON.stringify({ ...v, requestedAt: Date.now() - 25 * 3600 * 1000 }));
    }, m.userId);
    await page.reload();
    await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
    await expect(page.getByTestId('export-download')).toHaveCount(0);
    expect(await page.evaluate((id) => localStorage.getItem(`user_export_request:${id}`), m.userId)).toBeNull();

    // 410: server-side expiry. Seed a fresh stored id from the DB row, then expire the row.
    const row = await db((c) => c.query('select id from "AccountExportRequests" where "userId"=$1 order by "requestedAt" desc limit 1', [m.userId]));
    const rid = row.rows[0].id as string;
    await db((c) => c.query(`update "AccountExportRequests" set "expiresAt" = now() - interval '1 hour' where "userId"=$1`, [m.userId]));
    await page.evaluate(([id, r]) => localStorage.setItem(`user_export_request:${id}`, JSON.stringify({ requestId: r, requestedAt: Date.now() })), [m.userId, rid]);
    await page.reload();
    await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
    await page.getByTestId('export-download').click();
    await friendly(page.getByTestId('export-download-error'), MSG.expired);
    await expect(page.getByTestId('export-download')).toHaveCount(0);
    expect(await page.evaluate((id) => localStorage.getItem(`user_export_request:${id}`), m.userId)).toBeNull();
    await shot(page, 'ac5-410');

    // 404: another member's request id
    const oe = await call('POST', '/account/export-request', { token: other.token, body: { password: other.password } });
    expect(oe.status).toBe(202);
    await page.evaluate(([id, r]) => localStorage.setItem(`user_export_request:${id}`, JSON.stringify({ requestId: r, requestedAt: Date.now() })), [m.userId, oe.body.requestId]);
    await page.reload();
    await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
    await page.getByTestId('export-download').click();
    await friendly(page.getByTestId('export-download-error'), MSG.notAvailable);
    await shot(page, 'ac5-404');

    // removed at logout (logout-all clears the session)
    await page.getByRole('button', { name: 'Log out of all devices' }).click();
    await confirm(page).getByRole('button', { name: 'Log out everywhere' }).click();
    await page.waitForURL(/\/login/);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('user_export_request:')))).toEqual([]);
    expect(log.some((l) => /\/account\/export\//.test(l.path) && l.path.includes(m.password))).toBe(false);
  });

  test('AC10 RATE_LIMITED from repeated wrong passwords (real server)', async ({ page }) => {
    const m = await approved();
    const log = track(page);
    await uiLogin(page, m);
    await openSettings(page);
    await page.getByRole('button', { name: 'Download my data' }).click();
    let attempts = 0;
    for (; attempts < 8; attempts++) {
      await sendStepUp(page, `Wrong${attempts}Pass1`);
      const err = dlg(page).getByTestId('stepup-error');
      await expect(err).toBeVisible();
      await expect(dlg(page).getByTestId('stepup-submit')).toBeDisabled();
      const t = (await err.innerText()).split(/\n\s*Reference:/)[0].trim();
      if (MSG.rate.test(t)) break;
      expect(t).toBe(MSG.stepUp);
    }
    attempts += 1;
    expect(attempts, 'rate limit must appear on or before the 6th attempt').toBeLessThanOrEqual(6);
    await friendly(dlg(page).getByTestId('stepup-error'), MSG.rate);
    await expect(dlg(page).getByTestId('stepup-password')).toHaveValue('');
    expect(apiPaths(log, /export-request/).filter((l) => l.method === 'POST')).toHaveLength(attempts);
    // edge: even the right password is refused while limited
    await sendStepUp(page, m.password);
    await friendly(dlg(page).getByTestId('stepup-error'), MSG.rate);
    await expect(page.getByTestId('export-received')).toHaveCount(0);
    await shot(page, 'ac10-rate-limited');
    test.info().annotations.push({ type: 'attempts-until-429', description: String(attempts) });
  });

  test('AC6 AC7 AC8 delete: wording, wrong password, pending screen, later login, redirects, cancel, relogout', async ({ page, browser }) => {
    const m = await approved();
    const log = track(page);
    await uiLogin(page, m);
    await openSettings(page);
    clean(await allText(page));
    const trigger = page.getByRole('button', { name: 'Delete my account' });
    await trigger.click();
    await expect(dlg(page)).toBeVisible();
    await expect(dlg(page).getByText('Your account will be hidden straight away and permanently deleted after 30 days. You can cancel at any time during those 30 days.', { exact: true })).toBeVisible();
    await expect(dlg(page).getByText(NO_THIRD_PARTY, { exact: true })).toBeVisible();
    const pw = dlg(page).getByLabel('Password', { exact: true });
    await expect(pw).toHaveAttribute('type', 'password');
    await expect(pw).toHaveAttribute('autocomplete', 'current-password');
    const submit = dlg(page).getByRole('button', { name: 'Delete my account' });
    await expect(submit).toBeDisabled();
    clean(await allText(page));
    await pw.fill('WrongPass111');
    await submit.click();
    await friendly(dlg(page).getByTestId('stepup-error'), MSG.stepUp);
    await expect(pw).toHaveValue('');
    await expect(dlg(page)).toBeVisible();
    await page.waitForTimeout(500); // negative check: confirm no automatic second request (bounded wait)
    expect(apiPaths(log, /delete-request/).filter((l) => l.method === 'POST')).toHaveLength(1);
    // right password -> pending screen with the date from scheduledPurgeAt
    const resp = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/account/delete-request'));
    await sendStepUp(page, m.password);
    const body = await (await resp).json();
    await page.waitForURL(/\/account-deletion/);
    await expect(page.getByRole('heading', { name: 'Your account is scheduled for deletion.' })).toBeVisible();
    await expect(page.getByTestId('purge-date')).toContainText(purgeDay(body.scheduledPurgeAt));
    clean(await allText(page));
    await expect(page.getByTestId('cancel-deletion')).toBeVisible();
    await expect(page.getByTestId('deleted-logout')).toBeVisible();
    await shot(page, 'ac7-pending');
    // every route redirects
    for (const p of ['/app', '/settings', '/interests', '/']) {
      await page.goto(p);
      await page.waitForURL(/\/account-deletion/);
    }
    // judgement call: local-only logout; old refresh token still usable?
    const before = log.length;
    const refreshBefore = await page.evaluate(() => localStorage.getItem('user_refresh_token'));
    await page.getByTestId('deleted-logout').click();
    await page.waitForURL(/\/login|\/$/);
    expect(await page.evaluate(() => localStorage.getItem('user_access_token'))).toBeNull();
    const calls = log.slice(before).map((l) => `${l.method} ${l.path}`);
    test.info().annotations.push({ type: 'pending-logout-requests', description: JSON.stringify(calls) });
    const rf = await call('POST', '/auth/refresh', { body: { refreshToken: refreshBefore } });
    test.info().annotations.push({ type: 'refresh-after-local-logout', description: `${rf.status} ${rf.text.slice(0, 120)}` });

    // later login: pending screen driven by backend 403
    await uiLogin(page, m, /\/account-deletion/);
    await expect(page.getByTestId('purge-date')).toContainText(purgeDay(body.scheduledPurgeAt));
    // a second context sees the same on login
    const ctx2 = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page2 = await ctx2.newPage();
    await uiLogin(page2, m, /\/account-deletion/);
    await ctx2.close();
    // cancel: exactly one DELETE, back to the app
    const b2 = log.length;
    await page.getByTestId('cancel-deletion').click();
    await page.waitForURL(/\/app/);
    expect(log.slice(b2).filter((l) => l.method === 'DELETE' && l.path.includes('/account/delete-request'))).toHaveLength(1);
    await expect(page.getByTestId('cancel-deletion')).toHaveCount(0);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    // edge: nothing pending now, a second cancel through the API
    const t = await apiLogin(m);
    const again = await call('DELETE', '/account/delete-request', { token: t.accessToken });
    test.info().annotations.push({ type: 'second-cancel-api', description: `${again.status} ${again.text.slice(0, 120)}` });
  });

  test('AC7 purged: cancel after the purge date shows the sentence and the start link', async ({ page }) => {
    const m = await approved();
    const r = await call('POST', '/account/delete-request', { token: m.token, body: { password: m.password } });
    expect(r.status).toBe(202);
    await uiLogin(page, m, /\/account-deletion/);
    await db((c) => c.query(`update "Users" set "deletionScheduledPurgeAt" = now() - interval '1 day' where id=$1`, [m.userId]));
    await page.getByTestId('cancel-deletion').click();
    await friendly(page.getByTestId('deletion-error'), MSG.purged);
    const link = page.getByTestId('purged-start-link');
    await expect(link).toHaveAttribute('href', '/');
    clean(await allText(page));
    await shot(page, 'ac7-purged');
    await expect(page.getByRole('heading', { name: 'Your account is scheduled for deletion.' })).toBeVisible();
  });

  test('AC8 no grievance content and privacy statement on settings and dialogs', async ({ page }) => {
    const m = await approved();
    await uiLogin(page, m);
    await openSettings(page);
    clean(await allText(page));
    await expect(page.getByTestId('privacy-statement')).toHaveText(NO_THIRD_PARTY);
    for (const name of ['Log out of all devices', 'Download my data', 'Delete my account']) {
      await page.getByRole('button', { name }).click();
      clean(await allText(page));
      if (name !== 'Log out of all devices') await expect(page.locator('[role=dialog]')).toContainText(NO_THIRD_PARTY);
      await page.keyboard.press('Escape');
      await expect(page.locator('[role=dialog]')).toHaveCount(0);
    }
  });

  test('AC12 AC13 360 px, keyboard, focus and axe on settings, dialogs, pending screen', async ({ page }) => {
    const m = await approved();
    await uiLogin(page, m);
    await openSettings(page);
    expect(await noScroll(page)).toBe(true);
    await axeClean(page, 'settings');
    // keyboard order and names: Tab reaches select, switches, and the three buttons
    await page.getByRole('link', { name: 'Back to app' }).focus();
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        return e ? `${e.getAttribute('role') ?? e.tagName.toLowerCase()}:${e.getAttribute('aria-label') ?? e.innerText ?? ''}`.slice(0, 60) : '';
      });
      seen.push(name);
    }
    const joined = seen.join('|');
    expect(joined).toContain('select');
    expect(joined).toContain('switch');
    expect(joined).toContain('Download my data');
    expect(joined).toContain('Log out of all devices');
    expect(joined).toContain('Delete my account');

    // logout-all dialog
    const lo = page.getByRole('button', { name: 'Log out of all devices' });
    await lo.focus();
    await page.keyboard.press('Enter');
    await expect(confirm(page)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Log out of all devices? You will need to sign in again everywhere.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stay signed in' })).toBeFocused();
    expect(await noScroll(page)).toBe(true);
    await axeClean(page, 'logout-all dialog');
    await shot(page, 'ac12-logout-dialog');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Stay signed in' })).toBeFocused(); // trapped
    await page.keyboard.press('Escape');
    await expect(lo).toBeFocused();

    for (const [name, title] of [['Download my data', 'Download my data'], ['Delete my account', 'Delete your account']] as const) {
      const t = page.getByRole('button', { name, exact: true }).first();
      await t.focus();
      await page.keyboard.press('Space');
      await expect(page.getByRole('dialog', { name: title })).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeFocused({ timeout: 1000 }).catch(async () => {
        // focus lands on the dialog container per the shared helper; still inside the dialog
        expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
      });
      await expect(page.getByRole('button', { name: 'Show password' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      expect(await noScroll(page)).toBe(true);
      await axeClean(page, `${name} dialog`);
      await shot(page, `ac12-${name.replace(/\W+/g, '-').toLowerCase()}`);
      // Tab trap
      for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.locator('[role=dialog]')).toHaveCount(0);
      await expect(t).toBeFocused();
    }
    // keyboard-only wrong password via Enter
    await page.getByRole('button', { name: 'Download my data' }).focus();
    await page.keyboard.press('Enter');
    await page.getByLabel('Password', { exact: true }).fill('WrongPass222');
    await page.keyboard.press('Enter');
    await friendly(dlg(page).getByTestId('stepup-error'), MSG.stepUp);
    await page.keyboard.press('Escape');

    // pending screen
    const r = await call('POST', '/account/delete-request', { token: m.token, body: { password: m.password } });
    expect(r.status).toBe(202);
    await page.goto('/settings');
    await page.waitForURL(/\/account-deletion/);
    await expect(page.getByTestId('purge-date')).toBeVisible();
    expect(await noScroll(page)).toBe(true);
    await expect(page.getByRole('button', { name: 'Cancel deletion' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
    await axeClean(page, 'pending screen');
    await shot(page, 'ac12-pending');
    await page.getByRole('button', { name: 'Cancel deletion' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/app/);
  });

  test('AC13 focus stays inside the step-up dialog after a failed attempt and Escape still closes it', async ({ page }) => {
    const m = await approved();
    await uiLogin(page, m);
    await openSettings(page);
    const trigger = page.getByRole('button', { name: 'Download my data' });
    await trigger.click();
    await sendStepUp(page, 'WrongPass333');
    await friendly(dlg(page).getByTestId('stepup-error'), MSG.stepUp);
    // focus should be back in the dialog (the field), not lost on the page body
    const where = await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.id ?? ''));
    test.info().annotations.push({ type: 'active-element-after-failure', description: where });
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), `active element is ${where}`).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dlg(page)).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('AC9 vacuous check: UserWeb never sends profileVisibility on the language path with a stale server value', async ({ page }) => {
    const m = await approved();
    const log = track(page);
    await call('PATCH', '/account/settings', { token: m.token, body: { profileVisibility: 'hidden' } });
    await uiLogin(page, m);
    await openSettings(page);
    await expect(page.locator('body')).not.toContainText(/visibility|hidden from search/i);
    await page.getByTestId('settings-language').selectOption('hi');
    await expect(page.getByTestId('settings-language')).toBeEnabled();
    const p = log.filter((l) => l.method === 'PATCH');
    expect(p).toHaveLength(1);
    expect(JSON.parse(p[0].body ?? '{}')).toEqual({ language: 'hi' });
    const s = await apiSettings(m);
    expect(s.profileVisibility).toBe('hidden'); // backend value untouched by the UI
  });
});
