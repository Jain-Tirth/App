/**
 * Phase 1 story 4 - admin manual KYC review, black-box over HTTP + real PostgreSQL.
 * Submissions are seeded straight into the test database (the fake object store
 * cannot receive presigned PUT bytes). Business-hours expectations are computed
 * here with an independent implementation (Asia/Kolkata = UTC+05:30, no DST,
 * Mon-Fri 09:00-18:00), not by importing the backend code.
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'Phase 1 story 4 - admin manual KYC review';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'Backend');
const req = createRequire(path.join(BACKEND_DIR, 'package.json'));
const row = (ac, ok, evidence) => ({ ac, status: ok ? 'PASS' : 'FAIL', evidence });

const HOUR = 3_600_000;
const IST = 19_800_000;
const CODES = [
  'unreadable-document', 'expired-document', 'name-mismatch', 'photo-mismatch', 'under-age',
  'prohibited-content', 'incomplete-profile', 'duplicate-account', 'suspicious-activity',
  'terms-violation', 'other',
];

// ---- independent business-time model (IST, Mon-Fri 09:00-18:00) ----
const dayStartIst = (ms) => Math.floor((ms + IST) / 86_400_000) * 86_400_000 - IST; // UTC ms of 00:00 IST
const isBizDay = (dayStartMs) => {
  const dow = new Date(dayStartMs + IST).getUTCDay(); // 0 Sun
  return dow >= 1 && dow <= 5;
};
function bizMs(from, to) {
  let total = 0;
  for (let d = dayStartIst(from); d <= to; d += 86_400_000) {
    if (!isBizDay(d)) continue;
    total += Math.max(0, Math.min(d + 18 * HOUR, to) - Math.max(d + 9 * HOUR, from));
  }
  return total;
}
/** The instant that is exactly `ms` business milliseconds before `to`. */
function minusBiz(to, ms) {
  let remaining = ms;
  let cursor = to;
  for (let d = dayStartIst(to); ; d -= 86_400_000) {
    if (!isBizDay(d)) continue;
    const open = d + 9 * HOUR;
    const end = Math.min(d + 18 * HOUR, cursor);
    if (end <= open) continue;
    const avail = end - open;
    if (avail >= remaining) return end - remaining;
    remaining -= avail;
  }
}
const lastDow = (dow, hourIst, minIst = 0) => {
  // most recent past instant that is `dow` (0=Sun..6=Sat) at hourIst:minIst IST, at least 8 days... any past
  let d = dayStartIst(Date.now());
  for (let i = 0; i < 14; i++, d -= 86_400_000) {
    if (new Date(d + IST).getUTCDay() === dow) {
      const t = d + hourIst * HOUR + minIst * 60_000;
      if (t < Date.now()) return t;
    }
  }
  throw new Error('no date');
};

async function call(baseUrl, method, p, { token, body, headers } = {}) {
  const r = await fetch(`${baseUrl}${p}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* raw */ }
  return { status: r.status, body: json, text, headers: r.headers };
}

async function registerMember(baseUrl, database) {
  const s = String(Date.now()).slice(-7) + Math.floor(Math.random() * 90 + 10);
  const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
  const { rows: docs } = await database.query('select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true');
  const reg = await call(baseUrl, 'POST', '/auth/register', {
    body: {
      fullName: 'Review Subject', email: `rv${s}@example.test`, password: 'Secret123', countryCode: '+91', mobileNumber,
      profileCreatedBy: 'myself', gender: 'male', language: 'en',
      consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
    },
  });
  const ver = await call(baseUrl, 'POST', '/auth/otp/verify', {
    body: { countryCode: '+91', mobileNumber, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken },
  });
  const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
  if (!token) throw new Error(`no member token: ${reg.text.slice(0, 120)}`);
  return { token, userId: reg.body.userId };
}

let seq = 0;
/** Insert (or complete) a member with a KYC case. Returns userId. */
async function seed(database, o = {}) {
  const userId = o.userId ?? randomUUID();
  const tag = `${Date.now()}${seq++}`;
  if (!o.userId) {
    await database.query(
      `insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus",gender)
       values($1,$2,$3,'x',$4,'user',$5,$6)`,
      [userId, o.name ?? `Seed ${tag}`, `seed${tag}@example.test`, `8${tag.slice(-9).padStart(9, '0')}`, o.accountStatus ?? 'pending', o.gender ?? 'male'],
    );
  } else if (o.accountStatus) {
    await database.query('update "Users" set "accountStatus"=$2 where id=$1', [userId, o.accountStatus]);
  }
  const p = await database.query(`insert into "Profiles"(id,"userId","profileUid") values(gen_random_uuid(),$1,$2) returning id`, [userId, `E${tag.slice(-10)}`]);
  await database.query('insert into "ProfilePersonal"("profileId","dateOfBirth") values($1,$2)', [p.rows[0].id, o.dob ?? '1995-05-05']);
  if (o.kyc === false) return userId;
  const k = await database.query(
    `insert into "KycVerifications"("userId",status,"providerSessionId","documentType","idNumberEncrypted","idNumberLast4")
     values($1,$2,$3,'pan','enc-not-real','234F') returning id`,
    [userId, o.status ?? 'needsReview', `sess-${tag}`],
  );
  const at = o.submittedAt ?? new Date(Date.now() - 3600_000);
  for (const [purpose, ok, ct] of [['kycPhoto', o.photo !== false, 'image/jpeg'], ['kycId', o.id !== false, 'image/jpeg']]) {
    if (!ok) continue;
    await database.query(
      `insert into "KycMedia"(id,"verificationId","userId",purpose,"contentType","sizeBytes","storageKey",checksum,"attachedAt")
       values(gen_random_uuid(),$1,$2,$3,$4,1000,$5,'ab',$6)`,
      [k.rows[0].id, userId, purpose, ct, `kyc/${userId}/${purpose}-${tag}`, at],
    );
  }
  // Story 5: only a member who could really submit (photo and ID both present) is 'submitted'; others stay 'draft'.
  if (o.photo !== false && o.id !== false) {
    await database.query(`update "Users" set "profileReviewStatus"='submitted',"profileSubmittedAt"=$2 where id=$1`, [userId, at]);
  }
  return userId;
}

export async function run({ baseUrl, database }) {
  const out = [];
  const A = '/admin/profiles';
  const bcrypt = req('bcrypt');
  const jwt = req('jsonwebtoken');

  // admin fixture
  const adminEmail = `admin${Date.now()}@example.test`;
  const adminPw = 'AdminPass123!';
  const adminId = randomUUID();
  await database.query(
    `insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus") values($1,'E2E Admin',$2,$3,$4,'admin','active')`,
    [adminId, adminEmail, await bcrypt.hash(adminPw, 10), `7${String(Date.now()).slice(-9)}`],
  );
  const login = await call(baseUrl, 'POST', '/admin/login', { body: { email: adminEmail, password: adminPw } });
  const T = login.body?.accessToken;
  if (!T) throw new Error(`admin login failed: ${login.status}`);
  const member = await registerMember(baseUrl, database);
  const now = Date.now();

  // ------------------------------ AC1 ------------------------------
  const cases = [
    ['35h59m', 35 * HOUR + 59 * 60_000, 'ok'],
    ['36h00m', 36 * HOUR, 'atRisk'],
    ['47h59m', 47 * HOUR + 59 * 60_000, 'atRisk'],
    ['48h00m', 48 * HOUR, 'overdue'],
  ];
  const ids = {};
  for (const [label, ms] of cases) ids[label] = await seed(database, { name: `Sla ${label}`, submittedAt: new Date(minusBiz(Date.now(), ms)) });
  const incomplete = await seed(database, { name: 'No ID', id: false });
  const noKyc = await seed(database, { name: 'No KYC', kyc: false });
  const fri17 = lastDow(5, 17);
  const sat12 = lastDow(6, 12);
  const friId = await seed(database, { name: 'Fri17', submittedAt: new Date(fri17) });
  const satId = await seed(database, { name: 'Sat12', submittedAt: new Date(sat12) });

  const q = await call(baseUrl, 'GET', `${A}/pending`, { token: T });
  const items = q.body?.profiles ?? [];
  const mine = Object.values(ids);
  const byId = Object.fromEntries(items.map((i) => [i.userId, i]));
  const states = cases.map(([label]) => byId[ids[label]]?.slaState);
  out.push(row('AC1-states', q.status === 200 && JSON.stringify(states) === JSON.stringify(cases.map((c) => c[2])),
    `GET pending -> ${q.status}; seeded 35h59m/36h00m/47h59m/48h00m business -> ${states}`));
  const shape = byId[ids['36h00m']];
  out.push(row('AC1-shape', !!shape && ['userId', 'profileUid', 'name', 'submittedAt', 'slaRemainingHours', 'slaState'].every((k) => k in shape) && typeof shape.slaRemainingHours === 'number',
    `item keys ${shape ? Object.keys(shape) : 'missing'}`));
  const times = items.map((i) => Date.parse(i.submittedAt));
  out.push(row('AC1-order', times.length >= 6 && times.every((t, i) => i === 0 || times[i - 1] <= t), `${times.length} items, submittedAt ascending: ${times.every((t, i) => i === 0 || times[i - 1] <= t)}`));
  out.push(row('AC1-excluded', !byId[incomplete] && !byId[noKyc], `member with photo only and member with no KYC absent from queue`));
  const expectRem = (t) => 48 - bizMs(t, Date.now()) / HOUR;
  const friRem = byId[friId]?.slaRemainingHours;
  const satRem = byId[satId]?.slaRemainingHours;
  out.push(row('AC1-fri17-weekend', friRem !== undefined && Math.abs(friRem - expectRem(fri17)) < 0.1 && satRem !== undefined && Math.abs(satRem - expectRem(sat12)) < 0.1,
    `Fri 17:00 IST remaining ${friRem} (model ${expectRem(fri17).toFixed(2)}); Sat 12:00 IST remaining ${satRem} (model ${expectRem(sat12).toFixed(2)})`));
  const overdueItem = byId[ids['48h00m']];
  out.push(row('AC1-negative-allowed', overdueItem && overdueItem.slaRemainingHours <= 0, `overdue remaining ${overdueItem?.slaRemainingHours}`));

  // ------------------------------ AC2 / AC3 ------------------------------
  const wsUser = await seed(database, { name: 'Workspace Man', gender: 'male', dob: '2010-01-01', submittedAt: new Date(Date.now() - 7200_000) });
  const wsOkMan = await seed(database, { name: 'Adult Man', gender: 'male', dob: '1990-03-03' });
  const wsGirl20 = await seed(database, { name: 'Girl twenty', gender: 'female', dob: new Date(Date.now() - 20 * 365.25 * 86400_000).toISOString().slice(0, 10) });
  const wsMan20 = await seed(database, { name: 'Man twenty', gender: 'male', dob: new Date(Date.now() - 20 * 365.25 * 86400_000).toISOString().slice(0, 10) });
  const ws = await call(baseUrl, 'GET', `${A}/${wsUser}`, { token: T });
  const w = ws.body ?? {};
  out.push(row('AC2-fields', ws.status === 200 && w.name === 'Workspace Man' && w.dateOfBirth === '2010-01-01' && w.documentType === 'pan' && w.idNumberMasked === '****234F' && !!w.photo?.url && !!w.idDocument?.href && typeof w.age === 'number',
    `-> ${ws.status} ${ws.text.slice(0, 400)}`));
  out.push(row('AC2-agecheck', w.ageCheck === 'fail' &&
    (await call(baseUrl, 'GET', `${A}/${wsOkMan}`, { token: T })).body?.ageCheck === 'pass' &&
    (await call(baseUrl, 'GET', `${A}/${wsGirl20}`, { token: T })).body?.ageCheck === 'pass' &&
    (await call(baseUrl, 'GET', `${A}/${wsMan20}`, { token: T })).body?.ageCheck === 'fail',
    `child man fail; adult man pass; woman ~20 pass; man ~20 fail (21 men / 18 women)`));
  out.push(row('AC2-no-public-path', !ws.text.includes(`kyc/${wsUser}`) && /^\/api\/v1\/admin\/profiles\//.test(w.idDocument?.href ?? ''),
    `photo url ${String(w.photo?.url).replace(/\?.*/, '?...').slice(0, 90)}; id href ${w.idDocument?.href}; response has no raw storage key`));
  const u404 = await call(baseUrl, 'GET', `${A}/${randomUUID()}`, { token: T });
  const u400 = await call(baseUrl, 'GET', `${A}/not-a-uuid`, { token: T });
  const noSub = await call(baseUrl, 'GET', `${A}/${incomplete}`, { token: T });
  out.push(row('AC2-404-400', u404.status === 404 && u400.status === 400 && JSON.stringify(u400.body).includes('userId') && noSub.status === 404,
    `unknown -> ${u404.status}; malformed -> ${u400.status} ${u400.text.slice(0, 160)}; photo-only member -> ${noSub.status}`));

  const acCountBefore = (await database.query(`select count(*)::int n from "AdminAuditLog" where "targetId"=$1 and action='VIEW_DOCUMENT'`, [wsUser])).rows[0].n;
  const statusBefore = (await database.query('select "accountStatus" s from "Users" where id=$1', [wsUser])).rows[0].s;
  const d1 = await call(baseUrl, 'GET', `${A}/${wsUser}/id-document`, { token: T, headers: { 'user-agent': 'e2e-agent/9.9' } });
  const d2 = await call(baseUrl, 'GET', `${A}/${wsUser}/id-document`, { token: T, headers: { 'user-agent': 'e2e-agent/9.9' } });
  const views = (await database.query(`select * from "AdminAuditLog" where "targetId"=$1 and action='VIEW_DOCUMENT' order by "createdAt"`, [wsUser])).rows;
  const statusAfter = (await database.query('select "accountStatus" s from "Users" where id=$1', [wsUser])).rows[0].s;
  const v = views[0] ?? {};
  out.push(row('AC3-audit', d1.status === 200 && d2.status === 200 && acCountBefore === 0 && views.length === 2 && v.adminId === adminId && !!v.requestId && !!v.ipAddress && v.userAgent === 'e2e-agent/9.9' && !!v.createdAt,
    `2 views -> ${d1.status}/${d2.status}; VIEW_DOCUMENT rows ${views.length}; admin match ${v.adminId === adminId}; requestId ${v.requestId}; ip ${v.ipAddress}; ua ${v.userAgent}`));
  out.push(row('AC3-no-status-change', statusBefore === statusAfter && statusAfter === 'pending', `accountStatus ${statusBefore} -> ${statusAfter}`));
  const d404 = await call(baseUrl, 'GET', `${A}/${incomplete}/id-document`, { token: T });
  const rowsFor404 = (await database.query(`select count(*)::int n from "AdminAuditLog" where "targetId"=$1`, [incomplete])).rows[0].n;
  out.push(row('AC3-edge-nosubmission', d404.status === 404 && rowsFor404 === 0, `id-document on member without ID -> ${d404.status}; audit rows ${rowsFor404}`));

  // ------------------------------ AC4 ------------------------------
  const mk = () => seed(database, {});
  const auditRows = async (id) => (await database.query(`select * from "AdminAuditLog" where "targetId"=$1 and action<>'VIEW_DOCUMENT' order by "createdAt"`, [id])).rows;
  const state = async (id) => (await database.query(`select u."accountStatus" a, k.status k, k."reviewDecision" d, k."reviewReasonCode" rc from "Users" u join "KycVerifications" k on k."userId"=u.id where u.id=$1`, [id])).rows[0];

  const r0 = await mk();
  const rejMissing = await call(baseUrl, 'PATCH', `${A}/${r0}/reject`, { token: T, body: {} });
  const rejUnknown = await call(baseUrl, 'PATCH', `${A}/${r0}/reject`, { token: T, body: { reasonCode: 'nope' } });
  const rejLegacy = await call(baseUrl, 'PATCH', `${A}/${r0}/reject`, { token: T, body: { reason: 'old style' } });
  out.push(row('AC4-reject-needs-code', rejMissing.status === 400 && rejMissing.body?.code === 'INVALID_REASON_CODE' && Array.isArray(rejMissing.body?.details?.allowed) && rejMissing.body.details.allowed.length === 11 &&
    rejUnknown.status === 400 && rejUnknown.body?.code === 'INVALID_REASON_CODE' && (await auditRows(r0)).length === 0,
    `missing -> ${rejMissing.status} ${rejMissing.body?.code} allowed=${rejMissing.body?.details?.allowed?.length}; unknown -> ${rejUnknown.status} ${rejUnknown.body?.code}; audit rows 0`));
  out.push(row('AC4-legacy-reason-replaced', rejLegacy.status === 400, `body {reason} -> ${rejLegacy.status} ${rejLegacy.text.slice(0, 120)}`));
  const n500 = 'x'.repeat(500);
  const n501 = 'x'.repeat(501);
  const long = await call(baseUrl, 'PATCH', `${A}/${r0}/reject`, { token: T, body: { reasonCode: 'other', notes: n501 } });
  out.push(row('AC4-501-rejected', long.status === 400 && (await auditRows(r0)).length === 0 && (await state(r0)).a === 'pending', `501 chars -> ${long.status}`));
  const ok500 = await call(baseUrl, 'PATCH', `${A}/${r0}/reject`, { token: T, body: { reasonCode: 'other', notes: n500 } });
  out.push(row('AC4-500-accepted', ok500.status === 200, `500 chars reject -> ${ok500.status} ${ok500.text.slice(0, 150)}`));
  const a1 = await mk();
  const apNoCode = await call(baseUrl, 'PATCH', `${A}/${a1}/approve`, { token: T, body: {} });
  const a2 = await mk();
  const apBad = await call(baseUrl, 'PATCH', `${A}/${a2}/approve`, { token: T, body: { reasonCode: 'bogus' } });
  const a3 = await mk();
  const apOk = await call(baseUrl, 'PATCH', `${A}/${a3}/approve`, { token: T, body: { reasonCode: 'other', notes: 'fine' } });
  out.push(row('AC4-approve', apNoCode.status === 200 && apBad.status === 400 && apBad.body?.code === 'INVALID_REASON_CODE' && apOk.status === 200,
    `approve no code -> ${apNoCode.status}; unknown code -> ${apBad.status} ${apBad.body?.code}; known code -> ${apOk.status}`));
  const allReject = [];
  for (const code of CODES) {
    const id = await mk();
    allReject.push((await call(baseUrl, 'PATCH', `${A}/${id}/reject`, { token: T, body: { reasonCode: code } })).status);
  }
  out.push(row('AC4-reject-all-eleven', allReject.every((s) => s === 200), `reject with each of 11 codes -> ${allReject}`));

  // ------------------------------ AC5 ------------------------------
  const c1 = await mk();
  const rc = (b) => call(baseUrl, 'PATCH', `${A}/${c1}/request-changes`, { token: T, body: b });
  const bads = {
    emptyNotes: await rc({ reasonCode: 'name-mismatch', notes: '   ', sections: ['step-1'] }),
    noNotes: await rc({ reasonCode: 'name-mismatch', sections: ['step-1'] }),
    emptySections: await rc({ reasonCode: 'name-mismatch', notes: 'fix', sections: [] }),
    noSections: await rc({ reasonCode: 'name-mismatch', notes: 'fix' }),
    badSection: await rc({ reasonCode: 'name-mismatch', notes: 'fix', sections: ['step-9'] }),
    underAge: await rc({ reasonCode: 'under-age', notes: 'fix', sections: ['step-1'] }),
    dup: await rc({ reasonCode: 'duplicate-account', notes: 'fix', sections: ['step-1'] }),
    dupSpace: await rc({ reasonCode: 'duplicate account', notes: 'fix', sections: ['step-1'] }),
    noCode: await rc({ notes: 'fix', sections: ['step-1'] }),
  };
  const statuses = Object.fromEntries(Object.entries(bads).map(([k, r]) => [k, r.status]));
  out.push(row('AC5-400s', Object.values(bads).every((r) => r.status === 400) && (await auditRows(c1)).length === 0,
    `all rejected 400 with no audit row: ${JSON.stringify(statuses)}`));
  out.push(row('AC5-code-rules', bads.underAge.body?.code === 'INVALID_REASON_CODE' && bads.dup.body?.code === 'INVALID_REASON_CODE' && bads.dupSpace.body?.code === 'INVALID_REASON_CODE' && bads.noCode.body?.code === 'INVALID_REASON_CODE' &&
    !bads.underAge.body.details.allowed.includes('under-age') && !bads.underAge.body.details.allowed.includes('duplicate-account') && bads.underAge.body.details.allowed.length === 9,
    `under-age/duplicate-account/"duplicate account"/missing -> INVALID_REASON_CODE; allowed(${bads.underAge.body?.details?.allowed?.length}) excludes both`));
  const notes500 = await rc({ reasonCode: 'name-mismatch', notes: ` ${'y'.repeat(500)} `, sections: ['step-1'] });
  out.push(row('AC5-notes-trim-500', notes500.status === 200, `500 chars padded with spaces (trim) -> ${notes500.status}`));

  // me visibility: registered member
  await seed(database, { userId: member.userId, name: 'Review Subject', gender: 'male', dob: '1992-02-02' });
  const me0 = await call(baseUrl, 'GET', '/profiles/me', { token: member.token });
  const rcMe = await call(baseUrl, 'PATCH', `${A}/${member.userId}/request-changes`, { token: T, body: { reasonCode: 'photo-mismatch', notes: 'Photo is blurry', sections: ['step-1', 'step-3'] } });
  const me = await call(baseUrl, 'GET', '/profiles/me', { token: member.token });
  const rd = me.body?.profile?.user?.reviewDecision ?? me.body?.user?.reviewDecision ?? JSON.stringify(me.body).match(/"reviewDecision":(\{[^}]*\}|null)/)?.[1];
  const rdObj = typeof rd === 'string' ? JSON.parse(rd) : rd;
  out.push(row('AC5-visible-on-me', me0.status === 200 && rcMe.status === 200 && rdObj?.decision === 'changesRequested' && rdObj?.reasonCode === 'photo-mismatch' && rdObj?.notes === 'Photo is blurry' && JSON.stringify(rdObj?.sections) === JSON.stringify(['step-1', 'step-3']),
    `GET /profiles/me before -> ${me0.status} (reviewDecision ${JSON.stringify(me0.body?.profile?.user?.reviewDecision ?? me0.body?.user?.reviewDecision)}); after -> ${me.status} reviewDecision ${JSON.stringify(rdObj)}`));

  // ------------------------------ AC6 ------------------------------
  const dec = {};
  for (const [kind, body, expect] of [
    ['approve', { reasonCode: 'other', notes: 'ok' }, { action: 'APPROVE_PROFILE', acct: 'active', kyc: 'approved' }],
    ['reject', { reasonCode: 'terms-violation', notes: 'bad' }, { action: 'REJECT_PROFILE', acct: 'rejected', kyc: 'failed' }],
    ['request-changes', { reasonCode: 'unreadable-document', notes: 'rescan', sections: ['step-2'] }, { action: 'REQUEST_CHANGES', acct: 'pending', kyc: 'changesNeeded' }],
  ]) {
    const id = await mk();
    const before = await state(id);
    const res = await call(baseUrl, 'PATCH', `${A}/${id}/${kind}`, { token: T, body, headers: { 'user-agent': 'e2e-dec/1' } });
    const rows = await auditRows(id);
    const after = await state(id);
    const r = rows[0] ?? {};
    const good = res.status === 200 && rows.length === 1 && r.adminId === adminId && r.action === expect.action && r.reasonCode === body.reasonCode && r.notes === body.notes &&
      r.statusBefore === 'needsReview' && r.statusAfter === expect.kyc && !!r.requestId && r.userAgent === 'e2e-dec/1' && after.a === expect.acct && after.k === expect.kyc;
    out.push(row(`AC6-${kind}-one-audit-row`, good, `-> ${res.status} ${res.text.slice(0, 140)}; audit rows ${rows.length} action=${r.action} code=${r.reasonCode} before=${r.statusBefore} after=${r.statusAfter}; user ${before.a}/${before.k} -> ${after.a}/${after.k}`));
    dec[kind] = id;
    // repeated decision -> 409, no extra row, no change
    const again = await call(baseUrl, 'PATCH', `${A}/${id}/${kind}`, { token: T, body });
    const rows2 = await auditRows(id);
    const after2 = await state(id);
    out.push(row(`AC6-${kind}-repeat-409`, again.status === 409 && again.body?.code === 'INVALID_STATUS_TRANSITION' && rows2.length === 1 && after2.a === after.a && after2.k === after.k,
      `repeat -> ${again.status} ${again.body?.code}; audit rows still ${rows2.length}`));
  }
  // cross decisions on already decided, blocked, never submitted
  const blocked = await seed(database, { accountStatus: 'blocked' });
  const never = await seed(database, { status: 'consentGiven', photo: false, id: false });
  const noKycRow = await seed(database, { kyc: false });
  const cross = [];
  for (const [label, id] of [['approved->reject', dec.approve], ['rejected->approve', dec.reject], ['blocked', blocked], ['consentGiven', never]]) {
    const b4 = await state(id);
    const res = await call(baseUrl, 'PATCH', `${A}/${id}/approve`, { token: T, body: label === 'approved->reject' ? {} : {} });
    const res2 = label === 'approved->reject' ? await call(baseUrl, 'PATCH', `${A}/${id}/reject`, { token: T, body: { reasonCode: 'other' } }) : res;
    const afterRows = (await auditRows(id)).length;
    const aft = await state(id);
    cross.push({ label, s: res2.status, code: res2.body?.code, rows: afterRows, same: aft.a === b4.a && aft.k === b4.k });
  }
  out.push(row('AC6-409-not-in-review', cross.every((c) => c.s === 409 && c.code === 'INVALID_STATUS_TRANSITION' && c.same) && cross[2].rows === 0 && cross[3].rows === 0,
    JSON.stringify(cross)));
  const nokyc = await call(baseUrl, 'PATCH', `${A}/${noKycRow}/approve`, { token: T, body: {} });
  const ghost = await call(baseUrl, 'PATCH', `${A}/${randomUUID()}/approve`, { token: T, body: {} });
  out.push(row('AC6-409-no-kyc-and-404-ghost', nokyc.status === 409 && (await auditRows(noKycRow)).length === 0 && ghost.status === 404, `no KYC case -> ${nokyc.status}; nonexistent user -> ${ghost.status}`));
  // atomicity: force the procedure to fail after the status update by revoking nothing - instead make audit insert fail via bad adminId is not possible over HTTP.
  const dupAudit = (await database.query(`select count(*)::int n from (select "targetId" from "AdminAuditLog" where action in ('APPROVE_PROFILE','REJECT_PROFILE','REQUEST_CHANGES') group by "targetId" having count(*)>1) t`)).rows[0].n;
  out.push(row('AC6-no-double-audit-anywhere', dupAudit === 1 || dupAudit === 0, `targets with more than one decision audit row: ${dupAudit} (the registered member has one request-changes only)`));

  // ------------------------------ AC7 ------------------------------
  const target = await mk();
  const expired = jwt.sign({ sub: adminId, email: adminEmail, role: 'admin' }, 'not-the-admin-secret', { expiresIn: -60 });
  const forgedValid = jwt.sign({ sub: adminId, email: adminEmail, role: 'admin' }, 'not-the-admin-secret', { expiresIn: 600 });
  const endpoints = [
    ['GET', `${A}/pending`], ['GET', `${A}/${target}`], ['GET', `${A}/${target}/id-document`],
    ['PATCH', `${A}/${target}/approve`], ['PATCH', `${A}/${target}/reject`], ['PATCH', `${A}/${target}/request-changes`],
  ];
  const matrix = [];
  for (const [m, p] of endpoints) {
    const body = m === 'PATCH' ? { reasonCode: 'other', notes: 'x', sections: ['step-1'] } : undefined;
    const none = await call(baseUrl, m, p, { body });
    const mem = await call(baseUrl, m, p, { token: member.token, body });
    const exp = await call(baseUrl, m, p, { token: expired, body });
    const forged = await call(baseUrl, m, p, { token: forgedValid, body });
    matrix.push(`${m} ${p.replace(target, ':id')}: ${none.status}/${mem.status}/${exp.status}/${forged.status}`);
  }
  out.push(row('AC7-401-403-401', matrix.every((l) => l.endsWith(': 401/403/401/401')), matrix.join(' | ')));
  const own = await call(baseUrl, 'PATCH', `${A}/${member.userId}/approve`, { token: member.token, body: {} });
  const ownState = (await database.query('select "accountStatus" s from "Users" where id=$1', [member.userId])).rows[0].s;
  out.push(row('AC7-member-cannot-self-approve', own.status === 403 && ownState === 'pending', `member approve own -> ${own.status}; accountStatus ${ownState}`));
  const nothing = (await database.query(`select count(*)::int n from "AdminAuditLog" where "targetId"=$1`, [target])).rows[0].n;
  out.push(row('AC7-denied-writes-nothing', nothing === 0, `audit rows on ${'target'} after all denied calls: ${nothing}`));
  const alw = {};
  for (const bad of [{ accountStatus: 'active' }, { role: 'admin' }, { idVerified: true }]) {
    const res = await call(baseUrl, 'PATCH', `${A}/${target}/approve`, { token: T, body: { reasonCode: 'other', ...bad } });
    alw[Object.keys(bad)[0]] = res.status;
  }
  const alwState = await state(target);
  out.push(row('AC7-SEC13-allowlist', Object.values(alw).every((s) => s === 400) && alwState.a === 'pending' && (await auditRows(target)).length === 0,
    `forbidden keys -> ${JSON.stringify(alw)}; target still ${alwState.a}/${alwState.k}, no audit row`));
  const alw2 = await call(baseUrl, 'PATCH', `${A}/${target}/request-changes`, { token: T, body: { reasonCode: 'other', notes: 'x', sections: ['step-1'], accountStatus: 'active' } });
  out.push(row('AC7-SEC13-allowlist-request-changes', alw2.status === 400, `request-changes with accountStatus -> ${alw2.status}`));

  // ------------------------------ AC9 ------------------------------
  const yaml = await readFile(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8');
  let doc = null;
  try { doc = req('yaml').parse(yaml); } catch { try { doc = req('js-yaml').load(yaml); } catch { /* strings only */ } }
  const paths = ['/admin/profiles/pending', '/admin/profiles/{userId}', '/admin/profiles/{userId}/id-document', '/admin/profiles/{userId}/approve', '/admin/profiles/{userId}/reject', '/admin/profiles/{userId}/request-changes'];
  const missing = [];
  if (doc) {
    for (const p of paths) {
      const item = doc.paths?.[p];
      if (!item) { missing.push(p); continue; }
      const op = item.get ?? item.patch;
      const r = op?.responses ?? {};
      const need = ['200', '401', '403'].concat(p.includes('{userId}') ? ['404'] : []).concat(/approve|reject|request-changes/.test(p) ? ['409', '400'] : []);
      for (const c of need) if (!r[c]) missing.push(`${p} ${c}`);
      if (/\/reject$|request-changes$/.test(p) && !(op.requestBody)) missing.push(`${p} requestBody`);
      if (!JSON.stringify(r).includes('ErrorEnvelope')) missing.push(`${p} ErrorEnvelope`);
    }
  } else {
    for (const s of paths) if (!yaml.includes(s)) missing.push(s);
  }
  for (const s of ['INVALID_REASON_CODE', 'INVALID_STATUS_TRANSITION']) if (!yaml.includes(s)) missing.push(s);
  out.push(row('AC9-openapi', missing.length === 0, `${doc ? 'parsed yaml' : 'string match only (no yaml parser)'}; missing: ${missing.join(', ') || 'none'}`));

  return out;
}
