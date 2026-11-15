/**
 * Phase 1 story 5b: member UI for the approval state machine and the AdminPanel Reopen action.
 * Harness: real backend (dist/main.js, port 3101, test DB, fake storage) + UserWeb dev (5190) + AdminPanel dev (5183).
 * Seeding: real endpoints (register, PUT steps, POST /profiles/submit, admin PATCH decisions, admin reopen)
 * plus the seeded KYC case from tests/e2e/userweb/support.ts. Viewport 360 x 780 unless stated.
 *
 * MOCKED / BYPASSING cases (everything else is a real server answer, nothing is mocked):
 *  - AC2-notapproved: GET /profiles/matches is answered by page.route with a crafted 403 PROFILE_NOT_APPROVED
 *    (the real server only returns it when the status changed; the route handler flips the real DB status first).
 *  - AC5-mocked-list: POST /profiles/submit is answered by page.route with a crafted 409 SUBMISSION_INCOMPLETE
 *    listing step-2, consent and an unknown item (the real server only produces kycPhoto/kycId for a seeded member).
 *  - AC12-withdraw-stale: GET /profiles/me is aborted by page.route after load so the 4 second status poll cannot
 *    move the stale tab; the withdraw request itself is real.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '../../../AdminPanel/node_modules/@axe-core/playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  FRIENDLY_BAD, SUBMITTED_TEXT, db, decide, draftReadyToSubmit, draftWithProfile, memberAt, noHorizontalScroll,
  reopenViaApi, seedSubmittedKyc, signIn, statusOf, submitViaApi, type Member, type Status,
} from './support5b';

const ADMIN = 'http://localhost:5183';
const ART = path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-5b');
mkdirSync(ART, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${ART}/${name}.png`, fullPage: true });
const adminSeed = () => JSON.parse(readFileSync(path.resolve(ART, '..', 'ui-seed.json'), 'utf8'));

async function openAs(page: Page, m: Member, url: string) {
  await signIn(page, m);
  await page.goto(url);
}

async function adminLogin(page: Page) {
  const s = adminSeed();
  await page.goto(`${ADMIN}/login`);
  await page.getByPlaceholder('admin@dhobimatrimony.com').fill(s.email);
  await page.getByPlaceholder('••••••••').fill(s.password);
  await page.getByRole('button', { name: 'Sign In to Console' }).click();
  await page.waitForURL((u) => u.pathname === '/');
}

async function adminOpen(page: Page, m: Member) {
  await adminLogin(page);
  await page.goto(`${ADMIN}/profiles/${m.userId}`);
  await expect(page.getByTestId('workspace')).toBeVisible();
}

async function friendly(page: Page, testId: string, expected?: string | RegExp) {
  // UserWeb ErrorNotice has a sentence element (`-text`) apart from the Reference line; the AdminPanel notice is one element.
  await expect(page.getByTestId(testId)).toBeVisible();
  const loc = (await page.getByTestId(`${testId}-text`).count()) > 0 ? page.getByTestId(`${testId}-text`) : page.getByTestId(testId);
  const text = (await loc.innerText()).trim();
  for (const re of FRIENDLY_BAD) expect(text, `must not match ${re}`).not.toMatch(re);
  if (typeof expected === 'string') expect(text).toBe(expected);
  else if (expected) expect(text).toMatch(expected);
  return text;
}

async function seriousViolations(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}:${v.impact}:${v.nodes.length}:${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

// ------------------------------------------------------------------ AC1
test.describe('AC1 status routing after a real UI login', () => {
  const cases: Array<[Status, RegExp, string]> = [
    ['draft', /\/register$/, 'wizard-dob'],
    ['submitted', /\/pending$/, 'pending-submitted-text'],
    ['needsChanges', /\/pending$/, 'review-decision-panel'],
    ['rejected', /\/pending$/, 'review-decision-panel'],
    ['approved', /\/app$/, ''],
  ];
  // A rejected member cannot sign in: the backend login answers 403 (accountStatus rejected), so the rejected case
  // starts from an existing session (seeded tokens) instead of the login form. See the failing-by-design test below.
  for (const [status, url, anchor] of cases) {
    test(`AC1 ${status}`, async ({ page }) => {
      const m = await memberAt(status);
      if (status === 'rejected') {
        await openAs(page, m, '/');
        await page.goto('/login');
      } else {
        await page.goto('/login');
        await page.getByTestId('login-email').fill(m.email);
        await page.getByTestId('login-password').fill(m.password);
        await page.getByTestId('login-submit').click();
      }
      await expect(page).toHaveURL(url);
      if (anchor) await expect(page.getByTestId(anchor)).toBeVisible();
      if (status === 'needsChanges') {
        await expect(page.getByTestId('review-decision-panel')).toHaveAttribute('data-kind', 'changesRequested');
        await expect(page.getByTestId('review-sections')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Submit again' })).toBeVisible();
      }
      if (status === 'rejected') {
        await expect(page.getByTestId('review-decision-panel')).toHaveAttribute('data-kind', 'rejected');
        await expect(page.getByTestId('review-heading')).toHaveText('Profile not approved');
      }
      if (status === 'approved') await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await shot(page, `ac1-${status}`);
    });
  }
});

test('AC1 existing session: admin rejects while signed in, reload shows the rejected final state', async ({ page }) => {
  const m = await memberAt('submitted');
  await openAs(page, m, '/pending');
  await expect(page.getByTestId('pending-submitted-text')).toBeVisible();
  await decide(m.userId, 'reject', { reasonCode: 'duplicate-account', notes: 'Duplicate of another profile.' });
  await page.reload();
  await expect(page).toHaveURL(/\/pending$/);
  await expect(page.getByTestId('review-decision-panel')).toHaveAttribute('data-kind', 'rejected');
});

// Amended AC1: a rejected member cannot sign in (login answers 403); the logged-out member sees the "account on hold" message.
test('AC1 logged-out rejected member sees the account-on-hold login message', async ({ page }) => {
  const m = await memberAt('rejected');
  await page.goto('/login');
  await page.getByTestId('login-email').fill(m.email);
  await page.getByTestId('login-password').fill(m.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-error')).toContainText('your account may be on hold');
  await expect(page).toHaveURL(/\/login$/);
});

// ------------------------------------------------------------------ AC2
test.describe('AC2 direct navigation', () => {
  test('AC2 submitted opening /app, /register, /kyc is sent to /pending', async ({ page }) => {
    const m = await memberAt('submitted');
    await signIn(page, m);
    for (const p of ['/app', '/register', '/kyc']) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/pending$/);
      await expect(page.getByTestId('pending-submitted-text')).toBeVisible();
    }
  });
  test('AC2 rejected and needsChanges opening /app go to /pending', async ({ page }) => {
    for (const s of ['rejected', 'needsChanges'] as const) {
      const m = await memberAt(s);
      await page.context().clearCookies();
      await page.addInitScript(() => localStorage.clear());
      await openAs(page, m, '/app');
      await expect(page).toHaveURL(/\/pending$/);
    }
  });
  test('AC2 draft opening /app or /pending goes to onboarding', async ({ page }) => {
    const m = await memberAt('draft');
    await signIn(page, m);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/register$/);
    await page.goto('/pending');
    await expect(page).toHaveURL(/\/register$/);
  });
  test('AC2 approved opening /pending, /register, /kyc goes to /app', async ({ page }) => {
    const m = await memberAt('approved');
    await signIn(page, m);
    for (const p of ['/pending', '/register', '/kyc']) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/app$/);
    }
  });
  test('AC2 forged localStorage changes nothing', async ({ page }) => {
    const m = await memberAt('draft');
    await page.addInitScript(() => {
      for (const k of ['profileReviewStatus', 'user_profileReviewStatus', 'status', 'accountStatus', 'reviewStatus', 'user_status']) localStorage.setItem(k, 'approved');
      localStorage.setItem('user', JSON.stringify({ profileReviewStatus: 'approved', accountStatus: 'active' }));
      localStorage.setItem('profile', JSON.stringify({ profile: { user: { profileReviewStatus: 'approved' } } }));
    });
    await openAs(page, m, '/app');
    await expect(page).toHaveURL(/\/register$/);
  });
  test('AC2-notapproved PROFILE_NOT_APPROVED refreshes the profile and redirects (mocked 403, real status flip)', async ({ page }) => {
    const m = await memberAt('approved');
    await page.route('**/profiles/matches', async (route) => {
      // the real status moves first, then the crafted answer arrives, as it would in a stale tab
      await db((c) => c.query(`update "Users" set "profileReviewStatus"='submitted' where id=$1`, [m.userId]));
      await route.fulfill({
        status: 403, contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, code: 'PROFILE_NOT_APPROVED', message: 'Profile not approved', requestId: 'req-test' }),
      });
    });
    await openAs(page, m, '/app');
    await expect(page).toHaveURL(/\/pending$/);
    await expect(page.getByTestId('pending-submitted-text')).toHaveText(SUBMITTED_TEXT);
  });
});

// ------------------------------------------------------------------ AC3
test.describe('AC3 submitted state', () => {
  test('AC3 verbatim text, no time promise, one action', async ({ page }) => {
    const m = await memberAt('submitted');
    await openAs(page, m, '/pending');
    await expect(page.getByTestId('pending-submitted-text')).toHaveText(SUBMITTED_TEXT);
    const body = await page.locator('body').innerText();
    for (const w of ['24', '48', 'hours']) expect(body).not.toContain(w);
    await expect(page.getByRole('button', { name: 'Withdraw from review' })).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|update|submit/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /edit/i })).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ AC4
test.describe('AC4 submit button', () => {
  test('AC4 one click -> one request -> submitted message; double click -> one request', async ({ page }) => {
    const m = await draftReadyToSubmit();
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/profiles/submit')) posts.push(r.url()); });
    await openAs(page, m, '/kyc');
    const btn = page.getByRole('button', { name: 'Submit for review' });
    await expect(btn).toBeVisible();
    await btn.dblclick();
    await expect(page).toHaveURL(/\/pending$/);
    await expect(page.getByTestId('pending-submitted-text')).toHaveText(SUBMITTED_TEXT);
    expect(posts.length).toBe(1);
    expect(await statusOf(m)).toBe('submitted');
  });
  test('AC4 button is disabled with busy label in flight', async ({ page }) => {
    const m = await draftReadyToSubmit();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    await page.route('**/profiles/submit', async (route) => { await gate; await route.continue(); }); // delay only, request is real
    await openAs(page, m, '/kyc');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    const busy = page.getByTestId('submit-for-review-button');
    await expect(busy).toBeDisabled();
    await expect(busy).toContainText('Submitting...');
    release();
    await expect(page).toHaveURL(/\/pending$/);
  });
  test('AC4 never shown for submitted, rejected, approved', async ({ page }) => {
    for (const s of ['submitted', 'rejected', 'approved'] as const) {
      const m = await memberAt(s);
      await page.addInitScript(() => localStorage.clear());
      await openAs(page, m, '/kyc');
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('submit-for-review-button')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Submit for review' })).toHaveCount(0);
    }
  });
});

// ------------------------------------------------------------------ AC5
test.describe('AC5 missing items', () => {
  test('AC5 real SUBMISSION_INCOMPLETE lists photo and ID in plain words with links; status stays draft', async ({ page }) => {
    const m = await draftWithProfile();
    await openAs(page, m, '/kyc');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    const list = page.getByTestId('submit-missing');
    await expect(list).toBeVisible();
    await expect(page.getByTestId('submit-missing-kycPhoto')).toHaveText('Your photo');
    await expect(page.getByTestId('submit-missing-kycId')).toHaveText('Your ID document');
    expect(await list.innerText()).not.toMatch(/kycPhoto|kycId|SUBMISSION|step-\d/);
    expect(await statusOf(m)).toBe('draft');
    await page.getByTestId('submit-missing-kycPhoto').click();
    await expect(page).toHaveURL(/\/kyc$/);
  });
  test('AC5-mocked-list step, consent and unknown labels + links (crafted 409)', async ({ page }) => {
    const m = await draftReadyToSubmit();
    await page.route('**/profiles/submit', (route) =>
      route.fulfill({
        status: 409, contentType: 'application/json',
        body: JSON.stringify({ statusCode: 409, code: 'SUBMISSION_INCOMPLETE', message: 'm', requestId: 'r1', details: { missing: ['step-2', 'consent', 'mystery-item'] } }),
      }));
    await openAs(page, m, '/kyc');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expect(page.getByTestId('submit-missing-step-2')).toHaveText('Step 2 of your profile');
    await expect(page.getByTestId('submit-missing-consent')).toHaveText('Your consent to the terms');
    await expect(page.getByTestId('submit-missing-mystery-item')).toHaveText('Another required item');
    const text = await page.getByTestId('submit-missing').innerText();
    expect(text).not.toMatch(/mystery-item|step-2|consent\b(?! to)/);
    await page.getByTestId('submit-missing-step-2').click();
    await expect(page).toHaveURL(/\/register\?step=2/);
  });
});

// ------------------------------------------------------------------ AC6
test.describe('AC6 withdraw confirmation', () => {
  test('AC6 cancel and Escape send no request; confirm sends one and lands on onboarding with data kept', async ({ page }) => {
    const m = await memberAt('submitted');
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/profiles/withdraw')) posts.push(r.url()); });
    await openAs(page, m, '/pending');
    await page.getByRole('button', { name: 'Withdraw from review' }).click();
    const dlg = page.getByRole('dialog', { name: 'Withdraw your profile from review?' });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Keep in review' }).click();
    await expect(dlg).toHaveCount(0);
    await page.getByRole('button', { name: 'Withdraw from review' }).click();
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    expect(posts.length).toBe(0);
    await page.getByRole('button', { name: 'Withdraw from review' }).click();
    await dlg.getByRole('button', { name: 'Withdraw', exact: true }).dblclick();
    await expect(page).toHaveURL(/\/register$/);
    expect(posts.length).toBe(1);
    expect(await statusOf(m)).toBe('draft');
    const me = await (await fetch('http://127.0.0.1:3101/api/v1/profiles/me', { headers: { authorization: `Bearer ${m.token}` } })).json();
    expect(me.completion.completedSteps).toBe(5);
    await expect(page.getByTestId('wizard-dob')).not.toHaveValue('');
  });
  test('AC6 withdraw action absent for other statuses', async ({ page }) => {
    for (const s of ['needsChanges', 'rejected'] as const) {
      const m = await memberAt(s);
      await page.addInitScript(() => localStorage.clear());
      await openAs(page, m, '/pending');
      await expect(page.getByTestId('review-decision-panel')).toBeVisible();
      await expect(page.getByRole('button', { name: /withdraw/i })).toHaveCount(0);
    }
    const a = await memberAt('approved');
    await openAs(page, a, '/app');
    await expect(page.getByRole('button', { name: /withdraw/i })).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ AC7
test.describe('AC7 fix flow', () => {
  test('AC7 reason, notes, sections link to prefilled steps; edit; Submit again -> submitted message', async ({ page }) => {
    const m = await memberAt('needsChanges');
    await openAs(page, m, '/pending');
    await expect(page.getByTestId('review-reason')).toBeVisible();
    await expect(page.getByTestId('review-notes')).toContainText('Please fix your name.');
    await expect(page.getByTestId('review-sections')).toBeVisible();
    await page.getByTestId('review-section-step-1').click();
    await expect(page).toHaveURL(/\/register\?step=1/);
    await expect(page.getByTestId('wizard-dob')).not.toHaveValue('');
    const dob = await page.getByTestId('wizard-dob').inputValue();
    expect(dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.goto('/pending');
    await page.getByRole('button', { name: 'Submit again' }).click();
    await expect(page.getByTestId('pending-submitted-text')).toHaveText(SUBMITTED_TEXT);
    expect(await statusOf(m)).toBe('submitted');
  });
  test('AC7 stale tab: PROFILE_LOCKED_IN_REVIEW on step save shows friendly sentence + Withdraw to edit, keeps values', async ({ page }) => {
    const m = await draftReadyToSubmit();
    await openAs(page, m, '/register');
    await expect(page.getByTestId('wizard-dob')).not.toHaveValue('');
    const dobBefore = await page.getByTestId('wizard-dob').inputValue();
    await submitViaApi(m); // another session submits
    await page.getByTestId('wizard-save').click();
    const text = await friendly(page, 'wizard-error');
    expect(text).toMatch(/being reviewed/);
    expect(text).toMatch(/Withdraw to edit/);
    await expect(page.getByRole('button', { name: 'Withdraw to edit' })).toBeVisible();
    await expect(page.getByTestId('wizard-dob')).toHaveValue(dobBefore);
    await shot(page, 'ac7-locked');
    await page.getByRole('button', { name: 'Withdraw to edit' }).click();
    await expect(page).toHaveURL(/\/pending$/);
  });
});

// ------------------------------------------------------------------ AC8
test.describe('AC8 rejected final state', () => {
  test('AC8 reason, notes, cannot-resubmit sentence, no Edit/Submit/Withdraw; reopen shows fix flow', async ({ page }) => {
    const m = await memberAt('rejected');
    await openAs(page, m, '/pending');
    await expect(page.getByTestId('review-reason')).toBeVisible();
    await expect(page.getByTestId('review-notes')).toContainText('Duplicate of another profile.');
    await expect(page.getByText(/cannot be resubmitted/)).toBeVisible();
    await expect(page.getByRole('button', { name: /edit|update|submit|withdraw/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /edit|update|submit|withdraw/i })).toHaveCount(0);
    await reopenViaApi(m.userId);
    await page.reload();
    await expect(page.getByTestId('review-decision-panel')).toHaveAttribute('data-kind', 'changesRequested');
    await expect(page.getByRole('button', { name: 'Submit again' })).toBeVisible();
  });
});

// ------------------------------------------------------------------ AC9 (option a: keyed on accountStatus === 'rejected')
test.describe('AC9 AdminPanel reopen', () => {
  test('AC9 dialog gating, success, badge, button gone; member sees fix flow and resubmits', async ({ page, browser }) => {
    const m = await memberAt('rejected');
    await adminOpen(page, m);
    await page.setViewportSize({ width: 1280, height: 900 });
    const open = page.getByRole('button', { name: 'Reopen profile' });
    await expect(open).toBeVisible();
    await open.click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    const confirm = dlg.getByRole('button', { name: 'Confirm reopen' });
    await expect(confirm).toBeDisabled();
    const opts = await dlg.getByTestId('reopen-reason').locator('option').allTextContents();
    expect(opts.slice(1)).toEqual([
      'unreadable-document', 'expired-document', 'name-mismatch', 'photo-mismatch', 'under-age', 'prohibited-content',
      'incomplete-profile', 'duplicate-account', 'suspicious-activity', 'terms-violation', 'other',
    ]);
    await dlg.getByTestId('reopen-notes').fill('a'.repeat(600));
    expect(await dlg.getByTestId('reopen-notes').inputValue()).toHaveLength(500);
    await expect(dlg.getByTestId('reopen-remaining')).toContainText('0 characters remaining');
    await dlg.getByTestId('reopen-notes').fill('Please fix the photo.');
    await expect(dlg.getByTestId('reopen-remaining')).toContainText('479 characters remaining');
    await expect(confirm).toBeDisabled();
    await dlg.getByTestId('reopen-reason').selectOption('other');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByTestId('reopen-success')).toHaveText('Profile reopened. The member can now resubmit.');
    await expect(page.getByTestId('profile-status')).toHaveText('needsChanges');
    await expect(page.getByRole('button', { name: 'Reopen profile' })).toHaveCount(0);
    expect(await statusOf(m)).toBe('needsChanges');
    // member side, new context
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const mp = await ctx.newPage();
    await signIn(mp, m);
    await mp.goto('http://localhost:5190/pending');
    await expect(mp.getByTestId('review-decision-panel')).toHaveAttribute('data-kind', 'changesRequested');
    // Observed: a reject also clears the KYC files, so the first resubmit is a real SUBMISSION_INCOMPLETE (photo, ID).
    await mp.getByRole('button', { name: 'Submit again' }).click();
    await expect(mp.getByTestId('submit-missing-kycPhoto')).toHaveText('Your photo');
    await expect(mp.getByTestId('submit-missing-kycId')).toHaveText('Your ID document');
    expect(await statusOf(m)).toBe('needsChanges');
    await seedSubmittedKyc(m.userId); // stands in for the member re-uploading both files (seeded straight into the test DB)
    await mp.getByRole('button', { name: 'Submit again' }).click();
    await expect(mp.getByTestId('pending-submitted-text')).toHaveText(SUBMITTED_TEXT);
    expect(await statusOf(m)).toBe('submitted');
    await ctx.close();
  });
  for (const s of ['draft', 'submitted', 'approved', 'needsChanges'] as const) {
    test(`AC9 button absent for ${s}`, async ({ page }) => {
      const m = await memberAt(s);
      await adminLogin(page);
      await page.goto(`${ADMIN}/profiles/${m.userId}`);
      await page.waitForLoadState('networkidle');
      const ws = await page.getByTestId('workspace').isVisible();
      console.log(`AC9 ${s}: workspace visible=${ws}`);
      await expect(page.getByRole('button', { name: 'Reopen profile' })).toHaveCount(0);
      // a draft has no review workspace (admin page cannot load it), the other statuses do
      if (s !== 'draft') await expect(page.getByTestId('profile-status')).toBeVisible();
    });
  }
});

// ------------------------------------------------------------------ AC12
test.describe('AC12 friendly server errors end to end', () => {
  test('AC12 SUBMISSION_INCOMPLETE (real)', async ({ page }) => {
    const m = await draftWithProfile();
    await openAs(page, m, '/kyc');
    const resp = page.waitForResponse((r) => r.url().endsWith('/profiles/submit'));
    await page.getByRole('button', { name: 'Submit for review' }).click();
    const r = await resp;
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe('SUBMISSION_INCOMPLETE');
    await friendly(page, 'submit-error', 'Your profile is not complete yet. Please finish the items listed below and submit again.');
    await shot(page, 'ac12-incomplete');
  });
  test('AC12 INVALID_STATUS_TRANSITION on withdraw after admin approved in another session (real; polling aborted)', async ({ page }) => {
    const m = await memberAt('submitted');
    await openAs(page, m, '/pending');
    await page.getByRole('button', { name: 'Withdraw from review' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.route('**/profiles/me', (route) => route.abort()); // keep the tab stale
    await decide(m.userId, 'approve');
    const resp = page.waitForResponse((r) => r.url().endsWith('/profiles/withdraw'));
    await page.getByRole('dialog').getByRole('button', { name: 'Withdraw', exact: true }).click();
    const r = await resp;
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe('INVALID_STATUS_TRANSITION');
    await friendly(page, 'withdraw-error', 'Your profile can no longer be withdrawn because its review has already moved on. Please refresh to see the latest status.');
    await shot(page, 'ac12-withdraw');
  });
  test('AC12 PROFILE_LOCKED_IN_REVIEW on a step save (real, stale tab)', async ({ page }) => {
    const m = await draftReadyToSubmit();
    await openAs(page, m, '/register');
    await expect(page.getByTestId('wizard-dob')).not.toHaveValue('');
    await submitViaApi(m);
    const resp = page.waitForResponse((r) => r.url().endsWith('/profiles/step-1') && r.request().method() === 'PUT');
    await page.getByTestId('wizard-save').click();
    const r = await resp;
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe('PROFILE_LOCKED_IN_REVIEW');
    await friendly(page, 'wizard-error', /Your profile is being reviewed, so it cannot be edited right now\./);
  });
  test('AC12 INVALID_STATUS_TRANSITION in AdminPanel reopen after the profile was already reopened (real)', async ({ page }) => {
    const m = await memberAt('rejected');
    await adminOpen(page, m);
    await page.getByRole('button', { name: 'Reopen profile' }).click();
    await page.getByTestId('reopen-reason').selectOption('other');
    await reopenViaApi(m.userId); // another admin session already reopened it
    const resp = page.waitForResponse((r) => r.url().endsWith('/reopen'));
    await page.getByRole('button', { name: 'Confirm reopen' }).click();
    const r = await resp;
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe('INVALID_STATUS_TRANSITION');
    await friendly(page, 'reopen-error', 'This profile can no longer be reopened because its status has changed.');
  });
});

// ------------------------------------------------------------------ AC14 + AC15 on the 360 px viewport
test.describe('AC14 responsive at 360 px and AC15 accessibility', () => {
  for (const s of ['submitted', 'needsChanges', 'rejected'] as const) {
    test(`AC14/15 PendingPage ${s}`, async ({ page }) => {
      const m = await memberAt(s);
      await openAs(page, m, '/pending');
      await expect(page.getByTestId('pending-state')).toBeVisible();
      expect(await noHorizontalScroll(page)).toBe(true);
      const name = s === 'submitted' ? 'Withdraw from review' : s === 'needsChanges' ? 'Submit again' : 'Sign Out';
      const btn = page.getByRole('button', { name });
      await expect(btn).toBeVisible();
      const box = (await btn.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
      await shot(page, `ac14-pending-${s}`);
      expect(await seriousViolations(page), `axe ${s}`).toEqual([]);
    });
  }
  test('AC14/15 approved lands on AppPage (informational axe)', async ({ page }) => {
    const m = await memberAt('approved');
    await openAs(page, m, '/app');
    await expect(page).toHaveURL(/\/app$/);
    expect(await noHorizontalScroll(page)).toBe(true);
    console.log('AC15 AppPage axe serious/critical:', JSON.stringify(await seriousViolations(page)));
  });
  test('AC14/15 submit screen with missing list', async ({ page }) => {
    const m = await draftWithProfile();
    await openAs(page, m, '/kyc');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expect(page.getByTestId('submit-missing')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    const submit = page.getByRole('button', { name: 'Submit for review' });
    await submit.scrollIntoViewIfNeeded(); // vertical scrolling is fine; the check is that no sideways scroll is needed
    const box = (await submit.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    await shot(page, 'ac14-submit-missing');
    expect(await seriousViolations(page), 'axe submit screen').toEqual([]);
  });
  test('AC14/15 withdraw dialog + keyboard (focus in, Enter opens, Escape closes, focus returns, Tab trapped)', async ({ page }) => {
    const m = await memberAt('submitted');
    await openAs(page, m, '/pending');
    const trigger = page.getByRole('button', { name: 'Withdraw from review' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog', { name: 'Withdraw your profile from review?' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Keep in review' })).toBeFocused();
    expect(await noHorizontalScroll(page)).toBe(true);
    await expect(dlg.getByRole('button', { name: 'Withdraw', exact: true })).toBeInViewport();
    await shot(page, 'ac14-withdraw-dialog');
    expect(await seriousViolations(page), 'axe withdraw dialog').toEqual([]);
    await page.keyboard.press('Tab');
    await expect(dlg.getByRole('button', { name: 'Withdraw', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dlg.getByRole('button', { name: 'Keep in review' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
  test('AC15 Space activates the Submit button and Enter the section links by keyboard', async ({ page }) => {
    const m = await draftWithProfile();
    await openAs(page, m, '/kyc');
    await page.getByRole('button', { name: 'Submit for review' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('submit-missing')).toBeVisible();
    await page.getByTestId('submit-missing-kycPhoto').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/kyc$/);
  });
  test('AC14/15 AdminPanel reopen dialog at 360 px with keyboard and axe', async ({ page }) => {
    const m = await memberAt('rejected');
    await adminOpen(page, m);
    const trigger = page.getByRole('button', { name: 'Reopen profile' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dlg = page.getByRole('dialog', { name: 'Reopen this profile?' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByTestId('reopen-reason')).toBeFocused();
    await expect(dlg.getByRole('button', { name: 'Confirm reopen' })).toBeInViewport();
    const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    console.log('AdminPanel 360 scroll', JSON.stringify(scroll));
    await shot(page, 'ac14-admin-reopen-dialog');
    expect(scroll.sw).toBeLessThanOrEqual(scroll.iw);
    const scoped = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    const dlgSerious = scoped.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}:${v.impact}:${v.nodes.length}:${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    console.log('AC15 AdminPanel dialog-scoped axe serious/critical:', JSON.stringify(dlgSerious));
    const whole = await new AxeBuilder({ page }).analyze();
    console.log('AC15 AdminPanel whole-page axe serious/critical:', JSON.stringify(whole.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}:${v.nodes.length}:${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`)));
    expect(dlgSerious, 'axe reopen dialog (scoped)').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
