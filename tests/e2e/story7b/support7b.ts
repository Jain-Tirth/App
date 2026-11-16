/* Fixtures for phase 1 story 7b. Real test API (3101) and test database only; no source is touched. */
import { randomInt } from 'node:crypto';
import { db, call, type Member } from '../userweb/support';
import { memberAt } from '../story5b/support5b';

export * from '../story6b/support6b';

export const ADMIN = 'http://localhost:5183';
export const USER = 'http://localhost:5190';

export interface Party {
  m: Member;
  profileRef: string;
  profileUid: string;
}

/** Approved member built through the real endpoints; optionally relabelled female and moved to `city`. */
export async function party(o: { city?: string; female?: boolean } = {}): Promise<Party> {
  const m = await memberAt('approved');
  if (o.female) await db((c) => c.query(`update "Users" set gender='female' where id=$1`, [m.userId]));
  if (o.city) {
    await db(async (c) => {
      const p = await c.query(`select id from "Profiles" where "userId"=$1`, [m.userId]);
      await c.query(`update "ProfileLocations" set city=$2 where "profileId"=$1`, [p.rows[0].id, o.city]);
    });
  }
  const r = await db(async (c) => (await c.query(`select "profileRef" r,"profileUid" u from "Profiles" where "userId"=$1`, [m.userId])).rows[0]);
  return { m, profileRef: r.r, profileUid: r.u };
}

export const tagCity = () => `Ti${Date.now().toString(36)}${randomInt(100, 999)}`;

export async function sendApi(from: Party, to: Party) {
  const r = await call('POST', '/interests', { token: from.m.token, body: { receiverProfileRef: to.profileRef } });
  if (r.status !== 201) throw new Error(`send -> ${r.status} ${r.text.slice(0, 200)}`);
  return r.body as { id: string; status: string };
}

export async function actApi(by: Party, id: string, action: 'accept' | 'decline' | 'withdraw') {
  const r = await call('POST', `/interests/${id}/${action}`, { token: by.m.token });
  if (r.status !== 200 && r.status !== 201) throw new Error(`${action} -> ${r.status} ${r.text.slice(0, 200)}`);
  return r.body;
}

export const SENT_FIRST = 'Interest sent';
export const NOT_SERIOUS_WORDS = /declin|reject|reason/i;
