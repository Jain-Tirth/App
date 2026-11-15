/* Fixtures for phase 1 story 5b. Real test API (3101) and test database only; no source is touched. */
import type { Page } from '@playwright/test';
import { call, completeProfile, newMember, seedSubmittedKyc, adminToken, type Member } from '../userweb/support';

export * from '../userweb/support';

export type Status = 'draft' | 'submitted' | 'needsChanges' | 'rejected' | 'approved';

export const SUBMITTED_TEXT =
  'Your profile is currently under review. It will be made live once it has been approved by an admin.';

export const FRIENDLY_BAD = [/[A-Z]{2,}_[A-Z_]+/, /[{}]/, /^Error/, /\b[1-5][0-9]{2}\b/];

export async function submitViaApi(m: Member) {
  const r = await call('POST', '/profiles/submit', { token: m.token });
  if (r.status !== 200) throw new Error(`submit -> ${r.status} ${r.text.slice(0, 200)}`);
}

export async function decide(
  userId: string,
  action: 'approve' | 'reject' | 'request-changes',
  body: { reasonCode?: string; notes?: string; sections?: string[] } = {},
) {
  const t = await adminToken();
  const r = await call('PATCH', `/admin/profiles/${userId}/${action}`, { token: t, body });
  if (r.status >= 300) throw new Error(`${action} -> ${r.status} ${r.text.slice(0, 200)}`);
}

export async function reopenViaApi(userId: string, reasonCode = 'other', notes = 'reopened by test') {
  const t = await adminToken();
  const r = await call('POST', `/admin/profiles/${userId}/reopen`, { token: t, body: { reasonCode, notes } });
  if (r.status !== 200) throw new Error(`reopen -> ${r.status} ${r.text.slice(0, 200)}`);
}

/** A member in exactly the given review status, built only through real endpoints and the seeded KYC case. */
export async function memberAt(status: Status): Promise<Member> {
  const m = await newMember();
  if (status === 'draft') return m;
  await completeProfile(m);
  await seedSubmittedKyc(m.userId);
  await submitViaApi(m);
  if (status === 'submitted') return m;
  if (status === 'approved') await decide(m.userId, 'approve');
  if (status === 'rejected') await decide(m.userId, 'reject', { reasonCode: 'duplicate-account', notes: 'Duplicate of another profile.' });
  if (status === 'needsChanges') {
    await decide(m.userId, 'request-changes', { reasonCode: 'name-mismatch', notes: 'Please fix your name.', sections: ['step-1', 'step-2'] });
  }
  return m;
}

/** Draft member with the five steps done but no KYC files. */
export async function draftWithProfile(): Promise<Member> {
  const m = await newMember();
  await completeProfile(m);
  return m;
}

/** Draft member who has everything needed to submit. */
export async function draftReadyToSubmit(): Promise<Member> {
  const m = await newMember();
  await completeProfile(m);
  await seedSubmittedKyc(m.userId);
  return m;
}

export async function statusOf(m: Member): Promise<string> {
  const r = await call('GET', '/profiles/me', { token: m.token });
  return r.body?.profile?.user?.profileReviewStatus ?? 'none';
}

export async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}
