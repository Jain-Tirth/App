/**
 * Phase 1 story 10, AC7 (SEC-32): every way a session ends clears the app's own caches and the IndexedDB draft store;
 * a second member never sees the first member's drafts; drafts never hold government-ID or document fields.
 * Real backend (3101), built app (5191). One draft member per test, sequential.
 *
 * Members are "draft with a complete profile" (API steps 1..5, no KYC): the app lands them on the wizard (/register, step 1)
 * and /kyc is reachable by URL (it has the Sign out button). Wizard edits are made through the real form.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  call, completeProfile, ctl, dumpCaches, firstVisit, newMember, readDrafts, stubFonts, uiLogin, type Member,
} from './support10';

const DRAFT_DOB = '1991-07-07';
const ALLOWED = new Set([
  'gender', 'dateOfBirth', 'heightCm', 'weightKg', 'physicalStatus', 'maritalStatus', 'eatingHabits',
  'religion', 'caste', 'subcaste', 'gothra', 'openToAnySubcaste', 'dosh', 'country', 'state', 'city',
  'education', 'employmentType', 'occupation', 'incomeCurrency', 'annualIncomeRange', 'familyStatus', 'aboutMyself', 'lookingFor',
]);

test.beforeEach(async ({ context }) => {
  await ctl('reset');
  await stubFonts(context);
});

async function draftMember(): Promise<Member> {
  const m = await newMember();
  await completeProfile(m);
  return m;
}

/** Signs in (lands on /kyc), opens the wizard and types a date of birth that differs from the saved one; waits for IndexedDB. */
async function startDraft(page: Page, m: Member) {
  await firstVisit(page, '/login');
  await uiLogin(page, m, /\/(register|kyc)/);
  await page.goto('/register');
  await expect(page.getByTestId('wizard-dob')).toBeVisible();
  await page.getByTestId('wizard-dob').fill(DRAFT_DOB);
  await expect.poll(async () => (await readDrafts(page)).length, { timeout: 10_000 }).toBe(1);
}

/** A non-shell cache, as a stand-in for anything a buggy worker could have left behind. */
async function plantStrayCache(page: Page) {
  await page.evaluate(async () => {
    const c = await caches.open('stray-user-cache');
    await c.put('/stray.json', new Response('{"private":true}'));
  });
  expect(await page.evaluate(() => caches.keys())).toContain('stray-user-cache');
}

async function expectCleared(page: Page) {
  await expect.poll(async () => (await readDrafts(page)).length, { timeout: 10_000 }).toBe(0);
  await expect
    .poll(async () => (await dumpCaches(page)).keys.filter((k) => !k.startsWith('dhobi-shell-')), { timeout: 10_000 })
    .toEqual([]);
}

test('AC7 the draft is stored per user, restored after a reload, holds only allow-listed profile fields and no ID data', async ({ page }) => {
  const m = await draftMember();
  await startDraft(page, m);
  const rows = await readDrafts(page);
  expect(rows).toHaveLength(1);
  expect(rows[0].key).toBe(`${m.userId}\u0000profile-wizard`);
  const value = rows[0].value as Record<string, Record<string, unknown>>;
  expect(value.step1.dateOfBirth).toBe(DRAFT_DOB);
  for (const [group, fields] of Object.entries(value)) {
    expect(group).toMatch(/^step[1-5]$/);
    for (const f of Object.keys(fields)) expect(ALLOWED.has(f), `field ${f} is not an allowed profile field`).toBe(true);
  }
  const raw = JSON.stringify(rows);
  expect(raw).not.toMatch(/pan|aadhaar|aadhar|idNumber|passport|voter|licen[cs]e|document|kyc|selfie|photo|password|token/i);
  await page.reload();
  await expect(page.getByTestId('wizard-dob')).toHaveValue(DRAFT_DOB); // restored from IndexedDB
});

test('AC7 saving the step removes its draft (nothing stale is kept)', async ({ page }) => {
  const m = await draftMember();
  await startDraft(page, m);
  await page.getByTestId('wizard-save').click();
  await expect(page.getByText(/Step 2 of 5/)).toBeVisible();
  await expect.poll(async () => (await readDrafts(page)).length, { timeout: 10_000 }).toBe(0);
});

test('AC7 logout (KYC page Sign out) clears drafts and non-shell caches', async ({ page }) => {
  const m = await draftMember();
  await startDraft(page, m);
  await plantStrayCache(page);
  await page.goto('/kyc');
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  expect((await readDrafts(page)).length).toBe(1); // still there before logout (the reload did not clear it)
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL(/\/login|\/$/);
  await expectCleared(page);
  expect(await page.evaluate(() => localStorage.getItem('user_access_token'))).toBeNull();
});

test('AC7 logout-all (Settings) clears drafts and non-shell caches', async ({ page }) => {
  const m = await draftMember();
  await startDraft(page, m);
  await plantStrayCache(page);
  await page.goto('/settings');
  await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out of all devices' }).click();
  await page.getByRole('button', { name: 'Log out everywhere' }).click();
  await page.waitForURL(/\/login/);
  await expectCleared(page);
});

test('AC7 the pending-deletion screen Log out clears drafts and non-shell caches', async ({ page }) => {
  const m = await draftMember();
  await startDraft(page, m);
  await plantStrayCache(page);
  const del = await call('POST', '/account/delete-request', { token: m.token, body: { password: m.password } });
  expect(del.status, del.text).toBeLessThan(300);
  await page.goto('/register'); // any call now answers ACCOUNT_DELETION_PENDING -> the deleted-pending screen
  await page.waitForURL(/\/account-deletion/);
  expect((await readDrafts(page)).length).toBe(1);
  await page.getByTestId('deleted-logout').click();
  await page.waitForURL(/\/login|\/$/);
  await expectCleared(page);
});

test('AC7 a forced 401 (invalid tokens, not natural expiry) ends the session and clears drafts and non-shell caches', async ({ page }) => {
  const m = await draftMember();
  await startDraft(page, m);
  await plantStrayCache(page);
  await page.evaluate(() => {
    localStorage.setItem('user_access_token', 'not-a-valid-token');
    localStorage.setItem('user_refresh_token', 'not-a-valid-token');
  });
  await page.goto('/register');
  await page.waitForURL(/\/login/);
  await expectCleared(page);
});

test('AC7 negative across two users: after member one logs out, member two sees none of member one\'s draft', async ({ page }) => {
  const one = await draftMember();
  const two = await draftMember();
  await startDraft(page, one);
  await page.goto('/kyc');
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL(/\/login|\/$/);
  await uiLogin(page, two, /\/(register|kyc)/);
  await page.goto('/register');
  await expect(page.getByTestId('wizard-dob')).toBeVisible();
  await expect(page.getByTestId('wizard-dob')).not.toHaveValue(DRAFT_DOB);
  expect(await page.locator('body').innerText()).not.toContain(DRAFT_DOB);
  expect(JSON.stringify(await readDrafts(page))).not.toContain(DRAFT_DOB);
  expect(JSON.stringify(await readDrafts(page))).not.toContain(one.userId);
});

test('AC7 edge: even without a logout (tokens swapped by hand) member two\'s wizard does not load member one\'s draft (keyed by user id)', async ({ page }) => {
  const one = await draftMember();
  const two = await draftMember();
  await startDraft(page, one);
  await page.evaluate(([a, r]) => {
    localStorage.setItem('user_access_token', a);
    localStorage.setItem('user_refresh_token', r);
  }, [two.token, two.refresh]);
  await page.goto('/register');
  await expect(page.getByTestId('wizard-dob')).toBeVisible();
  await expect(page.getByTestId('wizard-dob')).not.toHaveValue(DRAFT_DOB);
  const keys = (await readDrafts(page)).map((r) => r.key);
  expect(keys).toEqual([`${one.userId}\u0000profile-wizard`]); // one's record is untouched and was not applied to two
});
