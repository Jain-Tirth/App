/**
 * Phase 1 story 5 - submit/withdraw/reopen/gating over HTTP + real PostgreSQL.
 * Executed against the disposable test database via npm --prefix Backend run test:api.
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
  out.push(row('AC8-reopen', ok.status === 200 && ok.body?.status === 'needsChanges' && st.a === 'pending' && (await audit()) === 1, `reopen -> ${ok.status} ${ok.text.slice(0, 600)}; body.status=${ok.body?.status}; db ${JSON.stringify(st)}; audit rows ${await audit()}`));
  const aud = (await database.query(`select action,"reasonCode",notes,"adminId","statusBefore","statusAfter" from "AdminAuditLog" where "targetId"=$1 and action='REOPEN_PROFILE'`, [m.userId])).rows[0];
  out.push(row('AC8-audit-row', !!aud && aud.reasonCode === 'other' && aud.notes === 'try again' && !!aud.adminId, `audit ${JSON.stringify(aud)} (spec says action 'reopen'; code uses REOPEN_PROFILE, matching story 4 APPROVE_PROFILE style)`));

  // ---- full happy path: complete the member through the DB seam, then submit over HTTP
  const complete = async (userId) => {
    await database.query(`update "Users" set gender='male' where id=$1`, [userId]);
    let pr = await database.query('select id from "Profiles" where "userId"=$1', [userId]);
    let pid = pr.rows[0]?.id;
    if (!pid) pid = (await database.query(`insert into "Profiles"(id,"userId","profileUid") values(gen_random_uuid(),$1,$2) returning id`, [userId, `E${String(Date.now()).slice(-10)}`])).rows[0].id;
    await database.query(`insert into "ProfilePersonal"("profileId","dateOfBirth") values($1,'1995-05-05') on conflict ("profileId") do update set "dateOfBirth"='1995-05-05'`, [pid]);
    for (const t of ['ProfileReligious', 'ProfileLocations', 'ProfileProfessional', 'ProfileFamilyBio']) {
      await database.query(`insert into "${t}"("profileId") values($1) on conflict ("profileId") do nothing`, [pid]);
    }
    const existing = (await database.query('select count(*)::int n from "KycVerifications" where "userId"=$1', [userId])).rows[0].n;
    if (existing) throw new Error(`seed: ${existing} KycVerifications rows already exist for a fresh member`);
    const k = await database.query(`insert into "KycVerifications"("userId",status,"providerSessionId","documentType","idNumberEncrypted","idNumberLast4") values($1,'needsReview',$2,'pan','enc-not-real','234F') returning id`, [userId, `sess-${userId}`]);
    for (const purpose of ['kycPhoto', 'kycId']) {
      await database.query(`insert into "KycMedia"(id,"verificationId","userId",purpose,"contentType","sizeBytes","storageKey",checksum,"attachedAt") values(gen_random_uuid(),$1,$2,$3,'image/jpeg',1000,$4,'ab',now())`, [k.rows[0].id, userId, purpose, `kyc/${userId}/${purpose}`]);
    }
  };
  const m2 = await registerMember(baseUrl, database);
  const partial = await call(baseUrl, 'POST', '/profiles/submit', { token: m2.token });
  await complete(m2.userId);
  const sub = await call(baseUrl, 'POST', '/profiles/submit', { token: m2.token });
  const st2 = (await database.query('select "profileReviewStatus" s,"accountStatus" a,"profileSubmittedAt" t from "Users" where id=$1', [m2.userId])).rows[0];
  out.push(row('AC1-happy', sub.status === 200 && sub.body?.status === 'submitted' && !!sub.body?.submittedAt && st2.s === 'submitted' && st2.a === 'pending', `incomplete first -> ${partial.status} missing=${JSON.stringify(partial.body?.details?.missing)}; complete submit -> ${sub.status} ${sub.text.slice(0, 200)}; db ${JSON.stringify(st2)}`));
  const missingOk = partial.status === 409 && ['step-1', 'kycPhoto', 'kycId'].every((x) => partial.body?.details?.missing?.includes(x));
  out.push(row('AC1-missing-named', missingOk, `missing=${JSON.stringify(partial.body?.details?.missing)}`));

  // AC2 idempotent + audit count
  const auditAll = async (id) => (await database.query(`select count(*)::int n from "AdminAuditLog" where "targetId"=$1`, [id])).rows[0].n;
  const a0 = await auditAll(m2.userId);
  const sub2 = await call(baseUrl, 'POST', '/profiles/submit', { token: m2.token });
  const same = sub2.status === 200 && sub2.body?.submittedAt === sub.body?.submittedAt && (await auditAll(m2.userId)) === a0;
  out.push(row('AC2-idempotent', same, `second submit -> ${sub2.status} submittedAt ${sub2.body?.submittedAt} vs ${sub.body?.submittedAt}; audit rows ${a0}->${await auditAll(m2.userId)}`));

  // queue / SLA: visible when submitted, cleared on withdraw
  const inQueue = async (id) => {
    const q = await call(baseUrl, 'GET', '/admin/profiles/pending', { token: T });
    const items = q.body?.profiles ?? (Array.isArray(q.body) ? q.body : []);
    return { found: items.find((i) => i.userId === id), status: q.status };
  };
  const q1 = await inQueue(m2.userId);
  const wd2 = await call(baseUrl, 'POST', '/profiles/withdraw', { token: m2.token });
  const q2 = await inQueue(m2.userId);
  const clk = (await database.query('select "profileSubmittedAt" t from "Users" where id=$1', [m2.userId])).rows[0].t;
  out.push(row('AC3-queue-sla', !!q1.found && wd2.status === 200 && !q2.found && clk === null, `in queue after submit=${!!q1.found} (list ${q1.status}); withdraw ${wd2.status}; in queue after=${!!q2.found}; profileSubmittedAt=${clk}`));

  // approved submit -> 409 ; AC4 resubmit
  await database.query(`update "Users" set "profileReviewStatus"='approved',"accountStatus"='active' where id=$1`, [m2.userId]);
  const fromApproved = await call(baseUrl, 'POST', '/profiles/submit', { token: m2.token });
  const gAppr = await call(baseUrl, 'GET', '/profiles/matches', { token: m2.token });
  out.push(row('AC2-approved-409', fromApproved.status === 409 && fromApproved.body?.code === 'INVALID_STATUS_TRANSITION', `submit from approved -> ${fromApproved.status} ${fromApproved.body?.code}`));
  out.push(row('AC6-approved-passes-gate', gAppr.status !== 403, `matches when approved -> ${gAppr.status}`));

  await database.query(`update "Users" set "profileReviewStatus"='needsChanges',"profileSubmittedAt"=now()-interval '3 days' where id=$1`, [m2.userId]);
  const before = (await database.query('select "dateOfBirth" d from "ProfilePersonal" pp join "Profiles" p on p.id=pp."profileId" where p."userId"=$1', [m2.userId])).rows[0];
  const re = await call(baseUrl, 'POST', '/profiles/submit', { token: m2.token });
  const after = (await database.query('select "dateOfBirth" d from "ProfilePersonal" pp join "Profiles" p on p.id=pp."profileId" where p."userId"=$1', [m2.userId])).rows[0];
  const fresh = Date.now() - Date.parse(re.body?.submittedAt) < 120000;
  out.push(row('AC4-resubmit', re.status === 200 && re.body?.status === 'submitted' && fresh && String(before.d) === String(after.d), `resubmit from needsChanges -> ${re.status} ${re.text.slice(0, 160)}; restarted(fresh)=${fresh}; data kept=${String(before.d) === String(after.d)}`));
  await database.query(`update "Users" set "profileReviewStatus"='rejected',"accountStatus"='rejected' where id=$1`, [m2.userId]);
  const rj = await call(baseUrl, 'POST', '/profiles/submit', { token: m2.token });
  out.push(row('AC4-rejected-409', rj.status === 409 && rj.body?.code === 'INVALID_STATUS_TRANSITION' && (await status2(database, m2.userId)) === 'rejected', `submit from rejected -> ${rj.status} ${rj.body?.code}`));
  // admin reopen then member resubmits
  const ro = await call(baseUrl, 'POST', `/admin/profiles/${m2.userId}/reopen`, { token: T, body: { reasonCode: 'other', notes: 'again' } });
  const rs = await call(baseUrl, 'POST', '/profiles/submit', { token: m2.token });
  out.push(row('AC8-reopen-then-submit', ro.status === 200 && rs.status === 200 && rs.body?.status === 'submitted', `reopen ${ro.status}; submit ${rs.status} ${rs.body?.status}`));
  // reopen from other states writes no audit
  const base = await auditAll(m2.userId);
  const states = [];
  for (const s of ['submitted', 'approved', 'needsChanges']) {
    await database.query(`update "Users" set "profileReviewStatus"=$2 where id=$1`, [m2.userId, s]);
    states.push((await call(baseUrl, 'POST', `/admin/profiles/${m2.userId}/reopen`, { token: T, body: { reasonCode: 'other' } })).status);
  }
  out.push(row('AC8-409-other-states', states.every((x) => x === 409) && (await auditAll(m2.userId)) === base, `reopen from submitted/approved/needsChanges -> ${states}; audit unchanged=${(await auditAll(m2.userId)) === base}`));

  // AC5 database single-writer check against the real catalog
  const procs = (await database.query(`select proname from pg_proc where pronamespace='public'::regnamespace and prokind in ('p','f') and prosrc ~* '(update\\s+"?Users"?\\s+(u\\s+)?set|,)\\s*"(profileReviewStatus|accountStatus)"\\s*='`)).rows.map((r) => r.proname);
  out.push(row('AC5-sql-writers', true, `procs/functions whose body writes accountStatus/profileReviewStatus: ${JSON.stringify(procs)} (informational; compare with handoff)`));
  const bad = procs.filter((p) => !['sp_set_profile_review_status', 'fn_register_user', 'fn_seed_admin_user'].includes(p) /* last two: documented registration/seed writers (handoff) */);
  out.push(row('AC5-sql-single-writer', bad.length === 0, `other writers in live DB: ${JSON.stringify(bad)}`));
  return out;
}
async function status2(database, id) { return (await database.query('select "profileReviewStatus" s from "Users" where id=$1', [id])).rows[0].s; }
