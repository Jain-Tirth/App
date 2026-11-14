/**
 * Phase 1 story 1b: member UI for stories 1 to 4, driven in a real browser at 360 px against the
 * real backend (test database, fake storage). Server errors are real server answers except where a
 * test says "mocked" (those are named and explained).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  ARTIFACTS, BAD_TEXT, call, completeProfile, db, dbSuper, isoYearsAgo, isoYearsAhead, jpegBytes,
  memberWithDecision, newMember, seedSubmittedKyc, signIn, uniq, adminDecide, type Member,
} from './support';

const shot = (page: Page, name: string) => page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage: true });

async function friendlyText(loc: Locator): Promise<string> {
  await expect(loc).toBeVisible();
  const text = (await loc.innerText()).trim();
  expect(text.length).toBeGreaterThan(8);
  for (const re of BAD_TEXT) expect(text, `text must not match ${re}`).not.toMatch(re);
  return text;
}

async function openWizard(page: Page, m: Member) {
  await signIn(page, m);
  await page.goto('/register');
  await expect(page.getByTestId('wizard-dob')).toBeVisible();
}

async function saveStep1AndCapture(page: Page) {
  const resp = page.waitForResponse((r) => r.url().endsWith('/profiles/step-1') && r.request().method() === 'PUT');
  await page.getByTestId('wizard-save').click();
  const r = await resp;
  return { status: r.status(), body: await r.json().catch(() => null) };
}

async function uiSignup(page: Page, o: { email: string; mobile: string; password?: string; tick?: boolean }) {
  await page.goto('/');
  await page.locator('[data-testid^="landing-register"]:visible').first().click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByTestId('signup-fullname').fill('Ui Signup');
  await page.getByTestId('signup-email').fill(o.email);
  await page.getByTestId('signup-password').fill(o.password ?? 'Secret123');
  await page.getByTestId('signup-mobile').fill(o.mobile);
  if (o.tick !== false) {
    await expect(page.getByTestId('consent-doc-terms')).toBeVisible();
    for (const code of ['terms', 'privacy', 'id_processing']) await page.getByTestId(`consent-checkbox-${code}`).check();
  }
}

const mobileNo = () => `9${uniq()}`.slice(0, 10).padEnd(10, '1');

// ------------------------------------------------------------------ AC3: seven real server errors
test.describe('AC3 real server errors shown as friendly text', () => {
  test('AC3-1 underage male DOB (server AGE_BELOW_MINIMUM)', async ({ page }) => {
    const m = await newMember();
    await openWizard(page, m);
    await page.getByTestId('wizard-gender-male').click();
    await page.getByTestId('wizard-dob').fill(isoYearsAgo(19));
    const res = await saveStep1AndCapture(page);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AGE_BELOW_MINIMUM');
    const text = await friendlyText(page.getByTestId('field-error-dateOfBirth'));
    expect(text).toMatch(/21/);
    await shot(page, 'ac3-1-underage-male');
  });

  test('AC3-2 underage female DOB (server AGE_BELOW_MINIMUM)', async ({ page }) => {
    const m = await newMember({ gender: 'female' });
    await openWizard(page, m);
    await page.getByTestId('wizard-gender-female').click();
    await page.getByTestId('wizard-dob').fill(isoYearsAgo(16));
    const res = await saveStep1AndCapture(page);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AGE_BELOW_MINIMUM');
    const text = await friendlyText(page.getByTestId('field-error-dateOfBirth'));
    expect(text).toMatch(/18/);
    await shot(page, 'ac3-2-underage-female');
  });

  test('AC3-3 future DOB (server answer)', async ({ page }) => {
    const m = await newMember();
    await openWizard(page, m);
    await page.getByTestId('wizard-dob').fill(isoYearsAhead(1));
    const res = await saveStep1AndCapture(page);
    expect(res.status).toBe(400);
    test.info().annotations.push({ type: 'server-code', description: String(res.body.code) });
    const text = await friendlyText(page.getByTestId('field-error-dateOfBirth'));
    expect(text).toMatch(/date of birth/i);
    await shot(page, 'ac3-3-future-dob');
  });

  test('AC3-4 KYC attempt without consent (server CONSENT_REQUIRED; gate bypassed with a patched consents/current)', async ({ page }) => {
    const m = await newMember({ withConsent: false });
    await completeProfile(m);
    await signIn(page, m);
    await page.route('**/consents/current*', async (route) => {
      const real = await route.fetch();
      const json = await real.json();
      json.consents = json.consents.map((c: any) => ({ ...c, accepted: true, expired: false, requiresReconsent: false }));
      await route.fulfill({ response: real, json });
    });
    const forbidden = page.waitForResponse((r) => r.url().includes('/kyc/verification') && r.status() === 403);
    await page.goto('/kyc');
    const r = await forbidden;
    expect((await r.json()).code).toBe('CONSENT_REQUIRED');
    // The page answers a 403 CONSENT_REQUIRED with the re-consent panel (its explanatory text is the message).
    const panel = page.getByTestId('reconsent-panel');
    await expect(panel).toBeVisible();
    const text = await friendlyText(panel.getByText('To continue, please read and accept the current documents.'));
    expect(text).toMatch(/accept/i);
    await shot(page, 'ac3-4-kyc-without-consent');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('AC3-5 oversized file (server FILE_TOO_LARGE; client check bypassed by rewriting sizeBytes)', async ({ page }) => {
    const m = await newMember();
    await completeProfile(m);
    await signIn(page, m);
    await page.route('**/kyc/verification/uploads', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const body = JSON.parse(route.request().postData() ?? '{}');
      body.sizeBytes = 10485761;
      await route.continue({ postData: JSON.stringify(body) });
    });
    await page.goto('/kyc');
    await expect(page.getByTestId('kyc-photo-input')).toBeVisible();
    await page.getByTestId('kyc-photo-input').setInputFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: jpegBytes(2048) });
    const resp = page.waitForResponse((r) => r.url().endsWith('/kyc/verification/uploads') && r.request().method() === 'POST');
    await page.getByTestId('kyc-photo-upload').click();
    const r = await resp;
    expect(r.status()).toBe(400);
    expect((await r.json()).code).toBe('FILE_TOO_LARGE');
    const text = await friendlyText(page.getByTestId('kyc-photo-error-text'));
    expect(text).toMatch(/too large/i);
    await shot(page, 'ac3-5-oversized');
  });

  test('AC3-6 wrong OTP (server 400)', async ({ page }) => {
    await uiSignup(page, { email: `ui1b${uniq()}@example.test`, mobile: mobileNo() });
    await page.getByTestId('signup-submit').click();
    await expect(page).toHaveURL(/\/otp$/);
    const real = (await page.getByTestId('otp-dev-code').innerText()).trim();
    const wrong = real === '0000' ? '1111' : '0000';
    await page.getByTestId('otp-input').fill(wrong);
    const resp = page.waitForResponse((r) => r.url().endsWith('/auth/otp/verify'));
    await page.getByTestId('otp-submit').click();
    const r = await resp;
    expect(r.status()).toBeGreaterThanOrEqual(400);
    const text = await friendlyText(page.getByTestId('otp-error-text'));
    expect(text).toMatch(/not correct|expired/i);
    await shot(page, 'ac3-6-wrong-otp');
  });

  test('AC3-7 wrong password (server 401)', async ({ page }) => {
    const m = await newMember();
    await page.goto('/login');
    await page.getByTestId('login-email').fill(m.email);
    await page.getByTestId('login-password').fill('NotThePassword9');
    const resp = page.waitForResponse((r) => r.url().endsWith('/auth/login'));
    await page.getByTestId('login-submit').click();
    expect((await resp).status()).toBe(401);
    const text = await friendlyText(page.getByTestId('login-error-text'));
    expect(text).toMatch(/email or password is incorrect/i);
    await shot(page, 'ac3-7-wrong-password');
  });
});

// ------------------------------------------------------------------ AC5 / AC6
test.describe('AC5 signup with consent and OTP', () => {
  test('AC5 landing -> /signup (consent checklist) -> OTP via dev code -> wizard', async ({ page }) => {
    await uiSignup(page, { email: `ui1b${uniq()}@example.test`, mobile: mobileNo(), tick: false });
    // three documents, all unticked, submit disabled
    for (const code of ['terms', 'privacy', 'id_processing']) {
      await expect(page.getByTestId(`consent-doc-${code}`)).toBeVisible();
      await expect(page.getByTestId(`consent-checkbox-${code}`)).not.toBeChecked();
    }
    await expect(page.getByTestId('signup-submit')).toBeDisabled();
    await page.getByTestId('consent-checkbox-terms').check();
    await page.getByTestId('consent-checkbox-privacy').check();
    await expect(page.getByTestId('signup-submit')).toBeDisabled(); // edge: two of three
    await page.getByTestId('consent-checkbox-id_processing').check();
    await expect(page.getByTestId('signup-submit')).toBeEnabled();
    await shot(page, 'ac5-signup-consent');

    const regResp = page.waitForResponse((r) => r.url().endsWith('/auth/register'));
    await page.getByTestId('signup-submit').click();
    const reg = await regResp;
    expect(reg.status()).toBe(201);
    await expect(page).toHaveURL(/\/otp$/);
    const code = (await page.getByTestId('otp-dev-code').innerText()).trim();
    expect(code).toMatch(/^\d{4}$/);
    await shot(page, 'ac5-otp');
    await page.getByTestId('otp-input').fill(code);
    await page.getByTestId('otp-submit').click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId('wizard-dob')).toBeVisible();
    await shot(page, 'ac5-wizard');
  });

  test('AC5 consent text is plain text and the language switcher reloads it', async ({ page }) => {
    await page.goto('/signup');
    const en = await page.getByTestId('consent-text-terms').innerText();
    expect(en.length).toBeGreaterThan(20);
    expect(await page.getByTestId('consent-doc-terms').locator('script, iframe, img').count()).toBe(0);
    await page.getByTestId('consent-language-hi').click();
    await expect(page.getByTestId('consent-text-terms')).not.toHaveText(en);
    await page.getByTestId('consent-language-gu').click();
    await expect(page.getByTestId('consent-text-terms')).not.toHaveText(en);
    await shot(page, 'ac5-language-gu');
  });
});

test.describe('AC6 no account enumeration', () => {
  test('AC6 duplicate email and duplicate mobile give the same sentence that names no field; login says one sentence', async ({ page }) => {
    const existing = await newMember();
    // duplicate email, fresh mobile
    await uiSignup(page, { email: existing.email, mobile: mobileNo() });
    await page.getByTestId('signup-submit').click();
    const dupEmail = await friendlyText(page.getByTestId('signup-error-text'));
    // duplicate mobile, fresh email
    await page.reload();
    await uiSignup(page, { email: `ui1b${uniq()}@example.test`, mobile: existing.mobile });
    await page.getByTestId('signup-submit').click();
    const dupMobile = await friendlyText(page.getByTestId('signup-error-text'));
    expect(dupMobile).toBe(dupEmail);
    expect(dupEmail).not.toMatch(/\b(email|mobile|phone)\b/i);
    await shot(page, 'ac6-duplicate');

    // login: wrong password for a real user and an unknown email read identically
    await page.goto('/login');
    await page.getByTestId('login-email').fill(existing.email);
    await page.getByTestId('login-password').fill('WrongPass999');
    await page.getByTestId('login-submit').click();
    const a = await friendlyText(page.getByTestId('login-error-text'));
    await page.getByTestId('login-email').fill(`nobody${uniq()}@example.test`);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error-text')).toHaveText(a);
  });
});

// ------------------------------------------------------------------ AC7
test.describe('AC7 re-consent gate and consent history', () => {
  test('AC7 member with no consent record sees the gate, accepts, continues (POST /consents)', async ({ page }) => {
    const m = await newMember({ withConsent: false });
    await signIn(page, m);
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST' && /\/consents(\/renew)?$/.test(r.url())) posts.push(new URL(r.url()).pathname); });
    await page.goto('/register');
    await expect(page.getByTestId('reconsent-panel')).toBeVisible();
    await expect(page.getByTestId('wizard-dob')).toHaveCount(0);
    await expect(page.getByTestId('reconsent-submit')).toBeDisabled();
    await shot(page, 'ac7-gate');
    for (const code of ['terms', 'privacy', 'id_processing']) await page.getByTestId(`consent-checkbox-${code}`).check();
    await page.getByTestId('reconsent-submit').click();
    await expect(page.getByTestId('wizard-dob')).toBeVisible();
    expect(posts.length).toBe(3);
    expect(posts.every((p) => p.endsWith('/consents'))).toBe(true);
    const rows = await db((c) => c.query('select count(*)::int n from "ConsentRecords" where "userId"=$1', [m.userId]));
    expect(rows.rows[0].n).toBe(3);
  });

  test('AC7 member with expired consent sees the gate and renews (POST /consents/renew)', async ({ page }) => {
    const m = await newMember();
    await dbSuper((c) => c.query(`update "ConsentRecords" set "expiresAt" = now() - interval '1 day' where "userId"=$1`, [m.userId]));
    await signIn(page, m);
    const posts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST' && /\/consents(\/renew)?$/.test(r.url())) posts.push(new URL(r.url()).pathname); });
    await page.goto('/register');
    await expect(page.getByTestId('reconsent-panel')).toBeVisible();
    for (const code of ['terms', 'privacy', 'id_processing']) await page.getByTestId(`consent-checkbox-${code}`).check();
    await page.getByTestId('reconsent-submit').click();
    await expect(page.getByTestId('wizard-dob')).toBeVisible();
    expect(posts.length).toBe(3);
    expect(posts.every((p) => p.endsWith('/consents/renew'))).toBe(true);
  });

  test('AC7 consent history on the dossier tab', async ({ page }) => {
    const m = await memberWithDecision('approve');
    await signIn(page, m);
    await page.goto('/app');
    await page.locator('button:visible', { hasText: /^My Profile/ }).first().click();
    await expect(page.getByTestId('consent-history')).toBeVisible();
    for (const code of ['terms', 'privacy', 'id_processing']) {
      await expect(page.getByTestId(`consent-record-${code}`)).toContainText('version');
    }
    await shot(page, 'ac7-history');
  });
});

// ------------------------------------------------------------------ AC8
test.describe('AC8 age hint and inline errors', () => {
  test('AC8 hint follows date and gender, makes no request, max is today (UTC)', async ({ page }) => {
    const m = await newMember();
    const step1Calls: string[] = [];
    page.on('request', (r) => { if (r.url().endsWith('/profiles/step-1') && r.method() === 'PUT') step1Calls.push(r.url()); });
    await openWizard(page, m);
    await expect(page.getByTestId('wizard-dob')).toHaveAttribute('max', new Date().toISOString().slice(0, 10));
    await page.getByTestId('wizard-gender-male').click();
    await page.getByTestId('wizard-dob').fill(isoYearsAgo(19));
    await expect(page.getByTestId('field-error-dateOfBirth')).toContainText('21');
    await page.getByTestId('wizard-gender-female').click();
    await expect(page.getByTestId('field-error-dateOfBirth')).toHaveCount(0);
    await page.getByTestId('wizard-dob').fill(isoYearsAgo(16));
    await expect(page.getByTestId('field-error-dateOfBirth')).toContainText('18');
    await page.getByTestId('wizard-gender-male').click();
    await expect(page.getByTestId('field-error-dateOfBirth')).toContainText('21');
    await page.getByTestId('wizard-dob').fill(isoYearsAgo(25));
    await expect(page.getByTestId('field-error-dateOfBirth')).toHaveCount(0);
    expect(step1Calls.length).toBe(0);
    await shot(page, 'ac8-hint');
  });

  test('AC8 valid adult date saves and moves to step 2', async ({ page }) => {
    const m = await newMember();
    await openWizard(page, m);
    await page.getByTestId('wizard-dob').fill(isoYearsAgo(25));
    const res = await saveStep1AndCapture(page);
    expect(res.status).toBe(200);
    await expect(page.getByText(/Step 2 of 5/)).toBeVisible();
  });
});

// ------------------------------------------------------------------ AC9
test.describe('AC9 KYC upload and status', () => {
  test('AC9 upload: storage PUT carries no Authorization, ticket content type, exact body; server complete error is friendly', async ({ page }) => {
    const m = await newMember();
    await completeProfile(m);
    await signIn(page, m);
    const puts: Array<{ headers: Record<string, string>; size: number; url: string }> = [];
    await page.route(/fake-storage\.invalid/, async (route) => {
      const req = route.request();
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'PUT,OPTIONS' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      puts.push({ headers: req.headers(), size: req.postDataBuffer()?.length ?? 0, url: req.url() });
      await route.fulfill({ status: 200, headers: cors, body: '' });
    });
    await page.goto('/kyc');
    await expect(page.getByTestId('kyc-status')).toHaveAttribute('data-status', 'consentGiven');
    await page.getByTestId('kyc-photo-input').setInputFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: jpegBytes(3000) });
    await expect(page.getByTestId('kyc-photo-preview')).toBeVisible();
    const ticketResp = page.waitForResponse((r) => r.url().endsWith('/kyc/verification/uploads') && r.request().method() === 'POST');
    await page.getByTestId('kyc-photo-upload').click();
    const ticket = await (await ticketResp).json();
    // fake storage cannot hold bytes, so the server's complete answers UPLOAD_NOT_FOUND
    const text = await friendlyText(page.getByTestId('kyc-photo-error-text'));
    expect(text).toMatch(/expired|could not be found/i);
    expect(puts.length).toBe(1);
    expect(puts[0].size).toBe(3000);
    expect(puts[0].headers['authorization']).toBeUndefined();
    const ticketType = Object.entries(ticket.headers as Record<string, string>).find(([k]) => k.toLowerCase() === 'content-type')?.[1];
    if (ticketType) expect(puts[0].headers['content-type']).toBe(ticketType);
    expect(puts[0].url).toBe(ticket.uploadUrl);
    await shot(page, 'ac9-upload-complete-error');
  });

  test('AC9 (mocked complete) both files attached -> needsReview -> /pending', async ({ page }) => {
    const m = await newMember();
    await completeProfile(m);
    await signIn(page, m);
    await page.route(/fake-storage\.invalid/, (route) => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'PUT,OPTIONS' };
      return route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200, headers: cors, body: '' });
    });
    let completes = 0;
    // MOCKED: the fake object store cannot receive bytes, so /complete is answered by the test.
    await page.route('**/kyc/verification/uploads/*/complete', async (route) => {
      completes += 1;
      const media = (purpose: string) => ({ mediaId: `00000000-0000-4000-8000-00000000000${purpose === 'kycPhoto' ? 1 : 2}`, purpose, contentType: 'image/jpeg', sizeBytes: 3000, attachedAt: new Date().toISOString() });
      const done = completes >= 2;
      await route.fulfill({ status: 200, contentType: 'application/json', json: {
        id: 'v1', status: done ? 'needsReview' : 'documentUploaded', documentType: 'pan', idNumberLast4: '234F',
        media: done ? [media('kycPhoto'), media('kycId')] : [media('kycPhoto')],
      } });
    });
    await page.goto('/kyc');
    await page.getByTestId('kyc-photo-input').setInputFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: jpegBytes(3000) });
    await page.getByTestId('kyc-photo-upload').click();
    await expect(page.getByTestId('kyc-status')).toHaveAttribute('data-status', 'documentUploaded');
    // ID without type/number: inline field errors, no request
    await page.getByTestId('kyc-id-input').setInputFiles({ name: 'id.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 0x20)]) });
    await page.getByTestId('kyc-id-upload').click();
    await friendlyText(page.getByTestId('field-error-documentType'));
    await friendlyText(page.getByTestId('field-error-idNumber'));
    await page.getByTestId('kyc-document-type').selectOption('pan');
    await page.getByTestId('kyc-id-number').fill('ABCDE1234F');
    await page.getByTestId('kyc-id-upload').click();
    await expect(page).toHaveURL(/\/pending$/);
    await shot(page, 'ac9-mocked-pending');
  });

  test('AC9 status card from a real needsReview case (masked ID, thumbnails, continue) and /pending gating', async ({ page }) => {
    const m = await newMember();
    await completeProfile(m);
    await signIn(page, m);
    // gating: no KYC case yet -> /pending sends the member to /kyc
    await page.goto('/pending');
    await expect(page).toHaveURL(/\/kyc$/);
    await seedSubmittedKyc(m.userId);
    await page.goto('/kyc');
    await expect(page.getByTestId('kyc-status')).toHaveAttribute('data-status', 'needsReview');
    await expect(page.getByTestId('kyc-id-last4')).toContainText('234F');
    await expect(page.getByTestId('kyc-thumb-kycPhoto')).toBeVisible();
    await expect(page.getByTestId('kyc-thumb-kycId')).toBeVisible();
    await expect(page.getByTestId('kyc-restart')).toHaveCount(0);
    await shot(page, 'ac9-status-needsReview');
    await page.getByTestId('kyc-continue').click();
    await expect(page).toHaveURL(/\/pending$/);
    await expect(page.getByTestId('pending-submitted-text')).toHaveText(
      'Your profile is currently under review. It will be made live once it has been approved by an admin.',
    );
    await shot(page, 'ac9-pending');
  });

  test('AC9 Start over after changes were requested', async ({ page }) => {
    const m = await memberWithDecision('request-changes', { reasonCode: 'unreadable-document', notes: 'Photo is blurry', sections: ['step-1'] });
    await signIn(page, m);
    await page.goto('/kyc');
    await expect(page.getByTestId('kyc-status')).toHaveAttribute('data-status', 'changesNeeded');
    await expect(page.getByTestId('kyc-restart')).toBeVisible();
    await shot(page, 'ac9-changesNeeded');
    await page.getByTestId('kyc-restart').click();
    await expect(page.getByTestId('kyc-status')).toHaveAttribute('data-status', 'consentGiven');
    await expect(page.getByTestId('kyc-photo-input')).toBeVisible();
    await shot(page, 'ac9-after-restart');
    // gating after restart: /pending bounces back to /kyc
    await page.goto('/pending');
    await expect(page).toHaveURL(/\/kyc$/);
  });
});

// ------------------------------------------------------------------ AC10
test.describe('AC10 review decision panel', () => {
  test('AC10 request-changes: reason, notes, sections link to wizard steps', async ({ page }) => {
    const m = await memberWithDecision('request-changes', { reasonCode: 'incomplete-profile', notes: 'Please add your city', sections: ['step-3', 'step-4'] });
    await signIn(page, m);
    await page.goto('/pending');
    const panel = page.getByTestId('review-decision-panel');
    await expect(panel).toHaveAttribute('data-kind', 'changesRequested');
    await expect(page.getByTestId('review-heading')).toHaveText('Changes needed');
    await expect(page.getByTestId('review-reason')).toHaveText('Your profile is incomplete');
    await expect(page.getByTestId('review-notes')).toHaveText('Please add your city');
    await expect(page.getByTestId('review-section-step-3')).toContainText('Location and residence');
    await expect(page.getByTestId('review-section-step-4')).toContainText('Education and career');
    await expect(page.getByTestId('review-section-step-1')).toHaveCount(0);
    await expect(page.getByTestId('review-kyc-restart')).toHaveCount(0);
    await shot(page, 'ac10-changes');
    await page.getByTestId('review-section-step-3').click();
    await expect(page).toHaveURL(/\/register\?step=3$/);
    await expect(page.getByText(/Step 3 of 5/)).toBeVisible();
  });

  test('AC10 request-changes for a document reason offers the KYC restart link', async ({ page }) => {
    const m = await memberWithDecision('request-changes', { reasonCode: 'unreadable-document', notes: 'Cannot read the ID', sections: ['step-1'] });
    await signIn(page, m);
    await page.goto('/pending');
    await expect(page.getByTestId('review-reason')).toHaveText('Your document could not be read clearly');
    await shot(page, 'ac10-document');
    await page.getByTestId('review-kyc-restart').click();
    await expect(page).toHaveURL(/\/kyc$/);
    await expect(page.getByTestId('kyc-status')).toHaveAttribute('data-status', 'changesNeeded');
  });

  test('AC10 rejected (final): no edit action', async ({ page }) => {
    const m = await memberWithDecision('reject', { reasonCode: 'under-age', notes: 'Below the minimum age' });
    await signIn(page, m);
    await page.goto('/pending');
    await expect(page.getByTestId('review-decision-panel')).toHaveAttribute('data-kind', 'rejected');
    await expect(page.getByTestId('review-heading')).toHaveText('Profile not approved');
    await expect(page.getByTestId('review-reason')).toHaveText('You do not meet the minimum age');
    await expect(page.getByTestId('review-edit-profile')).toHaveCount(0);
    await expect(page.getByTestId('review-kyc-restart')).toHaveCount(0);
    await shot(page, 'ac10-rejected-final');
  });

  test('AC10 rejected (not final): member may update the profile', async ({ page }) => {
    const m = await memberWithDecision('reject', { reasonCode: 'terms-violation', notes: 'Please follow the terms' });
    await signIn(page, m);
    await page.goto('/pending');
    await expect(page.getByTestId('review-heading')).toHaveText('Profile needs revision');
    await expect(page.getByTestId('review-edit-profile')).toBeVisible();
    await shot(page, 'ac10-rejected-open');
  });

  test('AC10 pending with no decision shows the exact submitted sentence; approved goes to /app', async ({ page }) => {
    const m = await newMember();
    await completeProfile(m);
    await seedSubmittedKyc(m.userId);
    await signIn(page, m);
    await page.goto('/pending');
    await expect(page.getByTestId('pending-submitted-text')).toBeVisible();
    await expect(page.getByTestId('review-decision-panel')).toHaveCount(0);
    await adminDecide(m.userId, 'approve');
    await page.getByRole('button', { name: /Check Approval Status/ }).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
  });
});
