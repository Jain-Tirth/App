/**
 * Phase 1 story 5 - submit/withdraw/reopen/gating over HTTP + real PostgreSQL.
 * NOTE: authored while Docker was unavailable; NOT YET EXECUTED. Re-run with test:env + test:api.
 */
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'Phase 1 story 5 - profile approval state machine';
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'Backend');
const req = createRequire(path.join(BACKEND_DIR, 'package.json'));
const row = (ac, ok, evidence) => ({ ac, status: ok ? 'PASS' : 'FAIL', evidence });

async function call(baseUrl, method, p, { token, body } = {}) {
  const r = await fetch(`${baseUrl}${p}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* raw */ }
  return { status: r.status, body: json, text };
}

async function registerMember(baseUrl, database) {
  const s = String(Date.now()).slice(-7) + Math.floor(Math.random() * 90 + 10);
  const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
  const { rows: docs } = await database.query('select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true');
  const reg = await call(baseUrl, 'POST', '/auth/register', { body: {
    fullName: 'State Subject', email: `st${s}@example.test`, password: 'Secret123', countryCode: '+91', mobileNumber,
    profileCreatedBy: 'myself', gender: 'male', language: 'en',
    consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
  } });
  const ver = await call(baseUrl, 'POST', '/auth/otp/verify', { body: { countryCode: '+91', mobileNumber, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken } });
  const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
  if (!token) throw new Error('no member token');
  return { token, userId: reg.body.userId };
}

export async function run({ baseUrl, database }) {
  const out = [];
  const bcrypt = req('bcrypt');
  const m = await registerMember(baseUrl, database);
  const status = async () => (await database.query('select "profileReviewStatus" s, "accountStatus" a from "Users" where id=$1', [m.userId])).rows[0];

  const s1 = await call(baseUrl, 'POST', '/profiles/submit', { token: m.token });
  out.push(row('AC1-incomplete', s1.status === 409 && s1.body?.code === 'SUBMISSION_INCOMPLETE' && Array.isArray(s1.body?.details?.missing) && s1.body.details.missing.includes('step-1') && (await status()).s === 'draft',
    `submit fresh member -> ${s1.status} ${s1.text.slice(0, 200)}`));

  const w = await call(baseUrl, 'POST', '/profiles/withdraw', { token: m.token });
  out.push(row('AC3-withdraw-from-draft', w.status === 409 && w.body?.code === 'INVALID_STATUS_TRANSITION', `withdraw from draft -> ${w.status} ${w.body?.code}`));

  const g = await call(baseUrl, 'GET', '/profiles/matches', { token: m.token });
  out.push(row('AC6-gating', g.status === 403 && g.body?.code === 'PROFILE_NOT_APPROVED' && g.body?.details?.status === 'draft', `matches while draft -> ${g.status} ${g.text.slice(0, 160)}`));
  const me = await call(baseUrl, 'GET', '/profiles/me', { token: m.token });
  out.push(row('AC6-onboarding-reachable', me.status === 200, `GET /profiles/me -> ${me.status}`));

  const mass = [];
  for (const k of ['status', 'accountStatus', 'profileReviewStatus', 'reviewStatus']) {
    mass.push((await call(baseUrl, 'PUT', '/profiles/step-1', { token: m.token, body: { [k]: 'approved' } })).status);
  }
  out.push(row('AC7-mass-assignment', mass.every((x) => x === 400), `step-1 with forbidden keys -> ${mass}`));

  // locked while submitted (force state in DB; the transition itself is covered by unit tests)
  await database.query(`update "Users" set "profileReviewStatus"='submitted' where id=$1`, [m.userId]);
  const lock = await call(baseUrl, 'PUT', '/profiles/step-1', { token: m.token, body: {} });
  out.push(row('AC7-locked', lock.status === 409 && lock.body?.code === 'PROFILE_LOCKED_IN_REVIEW', `step-1 while submitted -> ${lock.status} ${lock.body?.code}`));
  const wd = await call(baseUrl, 'POST', '/profiles/withdraw', { token: m.token });
  out.push(row('AC3-withdraw', wd.status === 200 && wd.body?.status === 'draft' && (await status()).s === 'draft', `withdraw -> ${wd.status} ${wd.text.slice(0, 120)}`));

  // admin reopen
  const adminEmail = `admin5${Date.now()}@example.test`;
  await database.query(`insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus") values($1,'E2E Admin',$2,$3,$4,'admin','active')`,
    [randomUUID(), adminEmail, await bcrypt.hash('AdminPass123!', 10), `7${String(Date.now()).slice(-9)}`]);
  const T = (await call(baseUrl, 'POST', '/admin/login', { body: { email: adminEmail, password: 'AdminPass123!' } })).body?.accessToken;
  const R = `/admin/profiles/${m.userId}/reopen`;
  const audit = async () => (await database.query(`select count(*)::int n from "AdminAuditLog" where "targetId"=$1 and action='REOPEN_PROFILE'`, [m.userId])).rows[0].n;
  const notRej = await call(baseUrl, 'POST', R, { token: T, body: { reasonCode: 'other', notes: 'x' } });
  out.push(row('AC8-409-from-draft', notRej.status === 409 && notRej.body?.code === 'INVALID_STATUS_TRANSITION' && (await audit()) === 0, `reopen from draft -> ${notRej.status}`));
  const none = await call(baseUrl, 'POST', R, { body: { reasonCode: 'other' } });
  const mem = await call(baseUrl, 'POST', R, { token: m.token, body: { reasonCode: 'other' } });
  const ghost = await call(baseUrl, 'POST', `/admin/profiles/${randomUUID()}/reopen`, { token: T, body: { reasonCode: 'other' } });
  const badCode = await call(baseUrl, 'POST', R, { token: T, body: { reasonCode: 'nope' } });
  const forged = await call(baseUrl, 'POST', R, { token: T, body: { reasonCode: 'other', profileReviewStatus: 'approved' } });
  out.push(row('AC8-auth-matrix', none.status === 401 && mem.status === 403 && ghost.status === 404 && badCode.status === 400 && forged.status === 400,
    `none/member/unknown/badcode/forged -> ${none.status}/${mem.status}/${ghost.status}/${badCode.status}/${forged.status}`));
  await database.query(`update "Users" set "profileReviewStatus"='rejected', "accountStatus"='rejected' where id=$1`, [m.userId]);
  const ok = await call(baseUrl, 'POST', R, { token: T, body: { reasonCode: 'other', notes: 'try again' } });
  const st = await status();
  out.push(row('AC8-reopen', ok.status === 200 && ok.body?.status === 'needsChanges' && st.a === 'pending' && (await audit()) === 1, `reopen -> ${ok.status} ${ok.text.slice(0, 140)}; db ${JSON.stringify(st)}; audit rows ${await audit()}`));
  return out;
}
