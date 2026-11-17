/* Fixtures for phase 1 story 10 (PWA). Real test API (3101) and test DB; the app under test is the BUILT UserWeb on 5191. */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { call, db, track, uiLogin, approved } from '../story9b/support9b';
import { memberAt } from '../story5b/support5b';
import { newMember, completeProfile, type Member } from '../userweb/support';
import { seedProfile } from '../story6b/support6b';
import { tag } from '../story8b/support8b';

export { call, db, track, uiLogin, approved, memberAt, newMember, completeProfile, seedProfile, tag };
export type { Member };

export const BASE = 'http://localhost:5191';
export const CTL = 'http://127.0.0.1:5191/__test';

export async function ctl(cmd: 'reset' | 'second-build' | 'down'): Promise<void> {
  const r = await fetch(`${CTL}/${cmd}`, { method: 'POST' });
  if (!r.ok) throw new Error(`ctl ${cmd} -> ${r.status}`);
}
export async function serverLog(): Promise<string[]> {
  return (await (await fetch(`${CTL}/log`)).json()) as string[];
}

export const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

/**
 * index.html loads Google Fonts from third-party origins. The test browser is not meant to reach the internet, so those two
 * origins are answered locally (cacheable, CORS-open responses, i.e. the worst case for a caching bug) and counted.
 */
export async function stubFonts(context: BrowserContext) {
  const hits: string[] = [];
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, async (route) => {
    hits.push(route.request().url());
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=31536000', 'content-type': 'text/css' },
      body: '/* stub font css */',
    });
  });
  return hits;
}

/** First visit: the worker is registered, active and controlling the page. */
export async function firstVisit(page: Page, url = '/') {
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

export interface CacheEntry {
  cache: string;
  url: string;
  responseType: string;
  requestHeaders: string[];
  responseHeaders: string[];
}

export async function dumpCaches(page: Page): Promise<{ keys: string[]; entries: CacheEntry[] }> {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const entries: any[] = [];
    for (const key of keys) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) {
        const res = await cache.match(req);
        entries.push({
          cache: key,
          url: req.url,
          responseType: res?.type ?? 'none',
          requestHeaders: Array.from(req.headers.keys()),
          responseHeaders: res ? Array.from(res.headers.keys()) : [],
        });
      }
    }
    return { keys, entries };
  });
}

/** Reads every record of the app's draft store. Opens with the same schema as the app so it never breaks the app's own open. */
export async function readDrafts(page: Page): Promise<Array<{ key: string; value: unknown }>> {
  return page.evaluate(
    () =>
      new Promise<Array<{ key: string; value: unknown }>>((resolve, reject) => {
        const open = indexedDB.open('dhobi-drafts', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('drafts');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('drafts', 'readonly');
          const store = tx.objectStore('drafts');
          const keys = store.getAllKeys();
          const values = store.getAll();
          tx.oncomplete = () => {
            db.close();
            resolve((keys.result as string[]).map((k, i) => ({ key: String(k), value: values.result[i] })));
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

/** A draft member lands on the wizard (/register). Types a date of birth and a free-text field without saving. */
export async function typeWizardDraft(page: Page, dob = '1994-03-12') {
  await expect(page.getByTestId('wizard-dob')).toBeVisible();
  await page.getByTestId('wizard-dob').fill(dob);
}

/** A beforeinstallprompt event with a controllable prompt(), as Chromium would dispatch it. */
export async function fireInstallEvent(page: Page, outcome: 'accepted' | 'dismissed' = 'accepted') {
  await page.evaluate((o) => {
    const ev: any = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = () => {
      (window as any).__installPromptCalls = ((window as any).__installPromptCalls ?? 0) + 1;
      return Promise.resolve();
    };
    ev.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(ev);
  }, outcome);
}

/** Signs in on the CURRENT login page without a reload, so a beforeinstallprompt captured earlier survives. */
export async function spaLogin(page: Page, m: Member, target: RegExp) {
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(target);
}

/** A member who has submitted the profile (PendingPage). Real endpoints only. */
export const submitted = () => memberAt('submitted');

export function noScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

const ART = path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-10');
mkdirSync(ART, { recursive: true });
export async function attachShot(page: Page, name: string) {
  await page.screenshot({ path: `${ART}/${name}.png`, fullPage: true });
}
