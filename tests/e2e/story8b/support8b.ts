/* Fixtures for phase 1 story 8b. Real test API (3101) and test database only; no source is touched. */
import { randomInt } from 'node:crypto';
import { db, call, type Member } from '../userweb/support';
import { memberAt } from '../story5b/support5b';

export * from '../story6b/support6b';

export const USER = 'http://localhost:5190';

export const MSG = {
  required: 'Enter a name for your list.',
  tooLong: 'Use 100 characters or fewer.',
  taken: 'You already have a list with this name.',
  protectedList:
    'Your Shortlisted list is always kept, so it cannot be renamed or deleted. You can create another list instead.',
  notFound: 'That list is no longer available. We have refreshed your lists, so please choose one and try again.',
  empty: 'Nothing here yet. Use the Shortlist button on a profile to save it.',
  notNotified: 'People you shortlist are not notified.',
};

/** Approved male member built through the real endpoints. */
export async function viewer(): Promise<Member> {
  return memberAt('approved');
}

export const tag = () => `Ts${Date.now().toString(36)}${randomInt(100, 999)}`;

export interface SL {
  id: string;
  name: string;
  isDefault: boolean;
  profileCount: number;
  createdAt: string;
}

export async function apiLists(m: Member): Promise<SL[]> {
  const r = await call('GET', '/shortlists', { token: m.token });
  if (r.status !== 200) throw new Error(`GET /shortlists -> ${r.status} ${r.text.slice(0, 200)}`);
  return r.body as SL[];
}

export async function apiCreate(m: Member, name: string): Promise<SL> {
  const r = await call('POST', '/shortlists', { token: m.token, body: { name } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`POST /shortlists ${name} -> ${r.status} ${r.text.slice(0, 200)}`);
  return r.body as SL;
}

export async function apiAdd(m: Member, listId: string, profileRef: string) {
  const r = await call('PUT', `/shortlists/${listId}/profiles/${profileRef}`, { token: m.token });
  if (r.status !== 200 && r.status !== 201) throw new Error(`PUT -> ${r.status} ${r.text.slice(0, 200)}`);
}

export async function apiDeleteList(m: Member, listId: string) {
  const r = await call('DELETE', `/shortlists/${listId}`, { token: m.token });
  if (r.status !== 204 && r.status !== 200) throw new Error(`DELETE list -> ${r.status} ${r.text.slice(0, 200)}`);
}

export async function apiMembers(m: Member, listId: string): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const r: any = await call('GET', `/shortlists/${listId}/profiles?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { token: m.token });
    out.push(...r.body.items.map((c: any) => c.profileRef));
    cursor = r.body.nextCursor;
    if (!cursor) break;
  }
  return out;
}

export async function hideFor(m: Member, hiddenUserId: string) {
  await db((c) => c.query(`insert into "HiddenProfiles"("userId","hiddenId") values($1,$2) on conflict do nothing`, [m.userId, hiddenUserId]));
}
