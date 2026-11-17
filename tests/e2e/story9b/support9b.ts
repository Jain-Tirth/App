/* Fixtures for phase 1 story 9b. Real test API (3101) and test database only; no source is touched. */
import type { Page } from '@playwright/test';
import { call, db, type Member } from '../userweb/support';
import { memberAt } from '../story5b/support5b';

export * from '../story6b/support6b';
export { call, db, memberAt };

export const USER = 'http://localhost:5190';
export const NO_THIRD_PARTY = 'Your data is not shared with third parties.';
export const FRIENDLY_BAD = [/[A-Z]{2,}_[A-Z_]+/, /[{}]/, /^Error/, /\b[1-5][0-9]{2}\b/];

export const MSG = {
  stepUp: 'That password is not correct.',
  alreadyPending:
    'You already have an export request waiting. Please use the download button once it is ready.',
  rate: /^Too many attempts\. Please (wait a few minutes before trying again|try again in .+)\.$/,
  expired: 'This download has expired. Request your data again.',
  notAvailable: 'That download is not available.',
  purged: 'This account has already been deleted.',
  language: 'That language is not available. Please choose one from the list.',
  loggedOut: 'You have been logged out of all devices.',
};

export const approved = (): Promise<Member> => memberAt('approved');

export function humanize(key: string): string {
  const w = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export const purgeDay = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

export interface Logged {
  method: string;
  path: string;
  body: string | null;
  auth: string | null;
}

/** Records every request to the test API (method, path, body, Authorization). */
export function track(page: Page) {
  const log: Logged[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.port === '3101') log.push({ method: r.method(), path: u.pathname.replace('/api/v1', '') + u.search, body: r.postData(), auth: r.headers()['authorization'] ?? null });
  });
  return log;
}

/** Signs in through the real login form. */
export async function uiLogin(page: Page, m: Member, target: RegExp = /\/(app|account-deletion)/) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(target);
}

export async function apiSettings(m: Member) {
  const r = await call('GET', '/account/settings', { token: m.token });
  if (r.status !== 200) throw new Error(`GET settings -> ${r.status} ${r.text.slice(0, 200)}`);
  return r.body as { language: string; notifications: Record<string, boolean>; profileVisibility?: string };
}

/** Fresh token for the member (the login in the UI may have rotated nothing, but sv can change after logout-all). */
export async function apiLogin(m: Member) {
  const r = await call('POST', '/auth/login', { body: { email: m.email, password: m.password } });
  if (r.status !== 200 && r.status !== 201) throw new Error(`login -> ${r.status} ${r.text.slice(0, 200)}`);
  return r.body.tokens as { accessToken: string; refreshToken: string };
}
