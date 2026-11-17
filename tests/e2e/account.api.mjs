/**
 * Phase 1 story 9 - account settings, logout-all, export, deletion, purge.
 * HTTP + real PostgreSQL (npm --prefix Backend run test:api). The purge job is run as the real
 * `npm run account:purge` CLI pointed at the test database.
 */
import { spawnSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'Phase 1 story 9 - account settings, logout-all, export, deletion, purge';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(HERE, '..', '..', 'Backend');
const require = createRequire(path.join(BACKEND_DIR, 'package.json'));
const yaml = (() => { try { const y = require('js-yaml'); return { parse: (t) => y.load(t) }; } catch { return null; } })();
const TEST_DB = 'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';
const PW = 'Secret123';

async function call(baseUrl, method, p, { token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(`${baseUrl}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* raw */ }
  return { status: r.status, body: json, text, headers: r.headers };
}

export async function run({ baseUrl, database }) {
  const out = [];
  const db = (sql, p) => database.query(sql, p);
  const add = (ac, ok, evidence) => out.push({ ac, status: ok ? 'PASS' : 'FAIL', evidence: String(evidence).slice(0, 900) });
  const check = async (ac, fn) => {
    try { const [ok, ev] = await fn(); add(ac, ok, ev); } catch (e) { add(ac, false, `threw ${e.message}`); }
  };
  const TAG = `AC${Date.now().toString(36)}${randomInt(1000, 9999)}`;
  const POST = (p, token, body) => call(baseUrl, 'POST', p, { token, body });
  const GET = (p, token) => call(baseUrl, 'GET', p, { token });
  const PUT = (p, token, body) => call(baseUrl, 'PUT', p, { token, body });
  const PATCH = (p, token, body) => call(baseUrl, 'PATCH', p, { token, body });
  const DEL = (p, token) => call(baseUrl, 'DELETE', p, { token });
  const observed = {}; // route -> Set(status), for the AC7 cross-check
  const seen = (key, r) => { (observed[key] ??= new Set()).add(r.status); return r; };

  async function register(gender, fullName = 'Account Caller') {
    const s = String(Date.now()).slice(-7) + randomInt(10, 99);
    const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
    const email = `ac${s}${randomInt(100, 999)}@example.test`;
    const { rows: docs } = await db('select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true');
    const reg = await POST('/auth/register', undefined, {
      fullName, email, password: PW, countryCode: '+91', mobileNumber,
      profileCreatedBy: 'myself', gender, language: 'en',
      consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
    });
    const ver = await POST('/auth/otp/verify', undefined, { countryCode: '+91', mobileNumber, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken });
    const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
    if (!token) throw new Error(`no member token ${ver.status} ${ver.text.slice(0, 200)}`);
    return { token, userId: reg.body.userId, email, mobile: `+91${mobileNumber}`, mobileNumber, fullName };
  }
  async function login(m) {
    const r = await POST('/auth/login', undefined, { email: m.email, password: PW });
    const t = r.body?.tokens ?? r.body;
    return { status: r.status === 201 ? 200 : r.status, rawStatus: r.status, token: t?.accessToken, refreshToken: t?.refreshToken, text: r.text };
  }
  async function approvedMember(gender = 'male', fullName) {
    const u = await register(gender, fullName);
    await db(`update "Users" set "profileReviewStatus"='approved',"accountStatus"='active' where id=$1`, [u.userId]);
    let r = await db(`select id, "profileRef" from "Profiles" where "userId"=$1`, [u.userId]);
    if (!r.rows[0]) {
      await db(`insert into "Profiles"("userId","profileUid") values($1,$2)`, [u.userId, `C${randomInt(100000000, 999999999)}${randomInt(10, 99)}`]);
      r = await db(`select id, "profileRef" from "Profiles" where "userId"=$1`, [u.userId]);
    }
    const pid = r.rows[0].id;
    await db(`insert into "ProfilePersonal"("profileId","dateOfBirth","heightCm") values($1,'1995-05-05',165) on conflict do nothing`, [pid]);
    await db(`update "ProfilePersonal" set "dateOfBirth"='1995-05-05' where "profileId"=$1`, [pid]);
    await db(`insert into "ProfileReligious"("profileId",religion,caste,subcaste) values($1,'Jain','Dhobi','Sub') on conflict do nothing`, [pid]);
    await db(`insert into "ProfileLocations"("profileId",country,state,city) values($1,'India','Gujarat',$2) on conflict do nothing`, [pid, TAG]);
    await db(`insert into "ProfileProfessional"("profileId",occupation,education) values($1,'Engineer','BSc') on conflict do nothing`, [pid]);
    await db(`insert into "ProfileFamilyBio"("profileId","aboutMyself","lookingFor","familyStatus") values($1,'a','b','middle') on conflict do nothing`, [pid]);
    return { ...u, profileId: pid, profileRef: r.rows[0].profileRef };
  }
  const row = async (sql, p) => (await db(sql, p)).rows[0];
  const b64 = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));

  // =================================================================== AC1
  const A = await approvedMember('male', 'Alpha Settings');
  const B = await approvedMember('male', 'Bravo Other');

  await check('AC1-defaults-get', async () => {
    const r = seen('GET /account/settings', await GET('/account/settings', A.token));
    const b = r.body ?? {};
    return [r.status === 200 && ['en', 'hi', 'gu'].includes(b.language) && typeof b.profileVisibility === 'string'
      && ['interestReceived', 'interestAccepted', 'profileApproved', 'newMessage', 'profileViewed'].every((k) => typeof b.notifications?.[k] === 'boolean'),
    `GET -> ${r.status} ${r.text.slice(0, 300)}; cache-control=${r.headers.get('cache-control')}`];
  });
  for (const lang of ['hi', 'gu', 'en']) {
    await check(`AC1-patch-language-${lang}`, async () => {
      const r = seen('PATCH /account/settings', await PATCH('/account/settings', A.token, { language: lang }));
      const g = await GET('/account/settings', A.token);
      const dbv = await row(`select language from "Users" where id=$1`, [A.userId]);
      return [r.status === 200 && r.body?.language === lang && g.body?.language === lang && dbv.language === lang,
        `PATCH -> ${r.status} ${r.text.slice(0, 200)}; GET language=${g.body?.language}; db Users.language=${dbv.language}`];
    });
  }
  await check('AC1-patch-partial-notifications-and-visibility', async () => {
    const before = (await GET('/account/settings', A.token)).body;
    const r = await PATCH('/account/settings', A.token, { notifications: { newMessage: false }, profileVisibility: 'hidden' });
    const g = (await GET('/account/settings', A.token)).body;
    const others = ['interestReceived', 'interestAccepted', 'profileApproved', 'profileViewed'].every((k) => g.notifications[k] === before.notifications[k]);
    return [r.status === 200 && g.notifications.newMessage === false && others && g.profileVisibility === 'hidden' && g.language === before.language,
      `PATCH -> ${r.status}; after=${JSON.stringify(g)}; untouched keys equal=${others}`];
  });
  await check('AC1-fr-400-field-issue', async () => {
    const r = seen('PATCH /account/settings', await PATCH('/account/settings', A.token, { language: 'fr' }));
    const issues = r.body?.details?.issues ?? [];
    const g = (await GET('/account/settings', A.token)).body;
    return [r.status === 400 && r.body?.code === 'VALIDATION_ERROR' && issues.some((i) => /^language /.test(i)) && g.language === 'en',
      `fr -> ${r.status} ${r.text.slice(0, 300)}; language still ${g.language}`];
  });
  await check('AC1-unknown-keys-400', async () => {
    const rs = [];
    for (const body of [{ role: 'admin' }, { accountStatus: 'active' }, { language: 'en', email: 'x@y.z' }, { notifications: { bogus: true } }, { profileVisibility: 'public' }]) {
      rs.push([JSON.stringify(body), await PATCH('/account/settings', A.token, body)]);
    }
    const dbv = await row(`select role, "accountStatus" from "Users" where id=$1`, [A.userId]);
    return [rs.every(([, r]) => r.status === 400 && r.body?.code === 'VALIDATION_ERROR') && dbv.role === 'user',
      rs.map(([k, r]) => `${k} -> ${r.status}`).join('; ') + `; db role=${dbv.role}`];
  });
  await check('AC1-no-token-401', async () => {
    const g = seen('GET /account/settings', await GET('/account/settings'));
    const p = await PATCH('/account/settings', undefined, { language: 'hi' });
    const bad = await GET('/account/settings', 'not.a.jwt');
    return [g.status === 401 && p.status === 401 && bad.status === 401, `GET ${g.status}, PATCH ${p.status}, garbage token ${bad.status}`];
  });
  await check('AC1-member-isolation', async () => {
    const bBefore = (await GET('/account/settings', B.token)).body;
    await PATCH('/account/settings', A.token, { language: 'gu', profileVisibility: 'all' });
    const bAfter = (await GET('/account/settings', B.token)).body;
    const spoof = await PATCH(`/account/settings?userId=${B.userId}`, A.token, { language: 'hi' });
    const bFinal = (await GET('/account/settings', B.token)).body;
    return [JSON.stringify(bBefore) === JSON.stringify(bAfter) && JSON.stringify(bAfter) === JSON.stringify(bFinal) && bFinal.language === 'en',
      `B settings unchanged after A patches (also with ?userId=B, status ${spoof.status}): ${JSON.stringify(bFinal)}`];
  });
  await check('AC1-body-userId-ignored-or-rejected', async () => {
    const r = await PATCH('/account/settings', A.token, { userId: B.userId, language: 'hi' });
    const bFinal = (await GET('/account/settings', B.token)).body;
    return [r.status === 400 && bFinal.language === 'en', `PATCH body with userId -> ${r.status}; B language ${bFinal.language}`];
  });

  // =================================================================== AC2
  const L = await approvedMember('male', 'Logout Lima');
  const M = await approvedMember('male', 'Mike Unaffected');
  await check('AC2-tokens-carry-sv-claim', async () => {
    const l = await login(L);
    const claims = l.token ? b64(l.token) : {};
    const rc = l.refreshToken ? b64(l.refreshToken) : {};
    return [l.status === 200 && claims.sv === 0 && rc.sv === 0, `login -> ${l.status}; access sv=${claims.sv}; refresh sv=${rc.sv}`];
  });
  await check('AC2-logout-all-http', async () => {
    const s1 = await login(L); // "device 1"
    const s2 = await login(L); // "device 2" (same single session row per the handoff)
    const m = await login(M);
    const before = await GET('/account/settings', s2.token);
    const r = seen('POST /account/logout-all', await POST('/account/logout-all', s2.token, undefined));
    const oldAccess = seen('GET /account/settings', await GET('/account/settings', s2.token));
    const otherAccess = await GET('/account/settings', s1.token);
    const ref1 = await POST('/auth/refresh', undefined, { refreshToken: s1.refreshToken });
    const ref2 = await POST('/auth/refresh', undefined, { refreshToken: s2.refreshToken });
    const sessions = await row(`select count(*)::int n from "UserSessions" where "userId"=$1`, [L.userId]);
    const sv = await row(`select "sessionVersion" v from "Users" where id=$1`, [L.userId]);
    const mAccess = await GET('/account/settings', m.token);
    const mRefresh = await POST('/auth/refresh', undefined, { refreshToken: m.refreshToken });
    const relogin = await login(L);
    const afterRelogin = await GET('/account/settings', relogin.token);
    return [before.status === 200 && r.status === 200 && oldAccess.status === 401 && otherAccess.status === 401 && ref1.status === 401 && ref2.status === 401
      && sessions.n === 0 && sv.v >= 1 && mAccess.status === 200 && (mRefresh.status === 200 || mRefresh.status === 201) && relogin.status === 200 && afterRelogin.status === 200,
    `logout-all -> ${r.status} ${r.text}; caller's old access ${oldAccess.status}; other-device access ${otherAccess.status}; refresh(dev1) ${ref1.status}, refresh(dev2) ${ref2.status}; UserSessions rows=${sessions.n}; sessionVersion=${sv.v}; member M access ${mAccess.status} refresh ${mRefresh.status}; fresh login ${relogin.status} -> settings ${afterRelogin.status}`];
  });
  await check('AC2-logout-all-no-token-401-and-body-rejected', async () => {
    const n = await POST('/account/logout-all', undefined, undefined);
    const l = await login(L);
    const bad = await POST('/account/logout-all', l.token, { userId: M.userId });
    const mStill = await GET('/account/settings', M.token);
    return [n.status === 401 && bad.status === 400 && mStill.status === 200, `no token ${n.status}; body {userId} ${bad.status}; M still ${mStill.status}`];
  });
  out.push({ ac: 'AC2-pre-migration-token-without-sv-still-works', status: 'BLOCKED', evidence: 'A token without an sv claim cannot be minted over HTTP; forging one needs JWT_SECRET (Backend/.env, denied to the tester). Only covered by Backend unit/integration tests (jwt.strategy: absent sv counts as 0). The claim shape of freshly issued tokens (sv=0) is asserted above.' });

  // =================================================================== AC3
  const E = await approvedMember('male', 'Echo Export');
  let exportId;
  await check('AC3-wrong-password-403-no-request', async () => {
    const r = seen('POST /account/export-request', await POST('/account/export-request', E.token, { password: 'Wrong-pass1' }));
    const n = await row(`select count(*)::int n from "AccountExportRequests" where "userId"=$1`, [E.userId]);
    const f = await row(`select count(*)::int n from "StepUpFailures" where "userId"=$1`, [E.userId]);
    return [r.status === 403 && r.body?.code === 'STEP_UP_FAILED' && n.n === 0 && f.n === 1, `-> ${r.status} ${r.text.slice(0, 200)}; export rows=${n.n}; failure rows=${f.n}`];
  });
  await check('AC3-missing-password-400', async () => {
    const a = await POST('/account/export-request', E.token, {});
    const b = await POST('/account/export-request', E.token, { password: 123 });
    const c = await POST('/account/export-request', E.token, { password: 'x'.repeat(129) });
    const d = await POST('/account/export-request', E.token, { password: PW, extra: 1 });
    const n = await row(`select count(*)::int n from "AccountExportRequests" where "userId"=$1`, [E.userId]);
    return [[a, b, c, d].every((r) => r.status === 400) && n.n === 0, `empty ${a.status}; number ${b.status}; 129 chars ${c.status}; extra key ${d.status}; export rows=${n.n}`];
  });
  await check('AC3-no-token-401', async () => {
    const r = seen('POST /account/export-request', await POST('/account/export-request', undefined, { password: PW }));
    return [r.status === 401, `-> ${r.status}`];
  });
  await check('AC3-correct-202-pending', async () => {
    const r = seen('POST /account/export-request', await POST('/account/export-request', E.token, { password: PW }));
    exportId = r.body?.requestId;
    const dbr = await row(`select status, "expiresAt", "requestedAt" from "AccountExportRequests" where id=$1`, [exportId]);
    const hours = dbr ? (dbr.expiresAt - dbr.requestedAt) / 3600000 : null;
    return [r.status === 202 && /^[0-9a-f-]{36}$/.test(exportId ?? '') && r.body?.status === 'pending' && dbr?.status === 'pending' && Math.abs(hours - 24) < 0.01,
      `-> ${r.status} ${r.text.slice(0, 300)}; db status=${dbr?.status}; ttl hours=${hours}`];
  });
  await check('AC3-second-call-409', async () => {
    const r = seen('POST /account/export-request', await POST('/account/export-request', E.token, { password: PW }));
    const n = await row(`select count(*)::int n from "AccountExportRequests" where "userId"=$1`, [E.userId]);
    return [r.status === 409 && r.body?.code === 'REQUEST_ALREADY_PENDING' && n.n === 1, `-> ${r.status} ${r.text.slice(0, 200)}; rows=${n.n}`];
  });
  const R = await approvedMember('male', 'Rate Limited');
  const S = await approvedMember('male', 'Rate Sibling');
  await check('AC3-five-failures-then-429-and-blocks-right-password', async () => {
    const fails = [];
    for (let i = 0; i < 5; i++) fails.push((await POST('/account/export-request', R.token, { password: `Wrong-pass${i}` })).status);
    const sixthWrong = seen('POST /account/export-request', await POST('/account/export-request', R.token, { password: 'Wrong-pass9' }));
    const sixthRight = await POST('/account/export-request', R.token, { password: PW });
    const delRight = await POST('/account/delete-request', R.token, { password: PW });
    const reqs = await row(`select count(*)::int n from "AccountExportRequests" where "userId"=$1`, [R.userId]);
    const del = await row(`select "deletionRequestedAt" d from "Users" where id=$1`, [R.userId]);
    const sibling = await POST('/account/export-request', S.token, { password: PW });
    const retry = Number(sixthWrong.headers.get('retry-after'));
    return [fails.every((s) => s === 403) && sixthWrong.status === 429 && sixthWrong.body?.code === 'RATE_LIMITED' && retry > 0 && retry <= 900
      && sixthRight.status === 429 && delRight.status === 429 && reqs.n === 0 && del.d === null && sibling.status === 202,
    `5 wrong -> ${fails}; 6th wrong -> ${sixthWrong.status} ${sixthWrong.body?.code} Retry-After=${retry}; 6th RIGHT export -> ${sixthRight.status}; RIGHT delete -> ${delRight.status} (counter shared); export rows=${reqs.n}; deletionRequestedAt=${del.d}; sibling member S right password -> ${sibling.status}`];
  });
  await check('AC3-window-expiry-releases-block', async () => {
    await db(`update "StepUpFailures" set "failedAt"="failedAt" - interval '16 minutes' where "userId"=$1`, [R.userId]);
    const r = await POST('/account/export-request', R.token, { password: PW });
    return [r.status === 202, `after moving the 5 failures 16 min back, right password -> ${r.status} ${r.text.slice(0, 120)}`];
  });

  // =================================================================== AC4
  const X = await approvedMember('male', 'Xavier Exporter');
  const Bx = await approvedMember('female', 'Bravo Secretsurname');
  const T = await approvedMember('female', 'Tango Sender');
  let archive; let archiveText; let xReq; let xLogin;
  await check('AC4-export-contents-and-forbidden-fields', async () => {
    xLogin = await login(X);
    const tok = xLogin.token;
    const interest = await POST('/interests', tok, { receiverProfileRef: Bx.profileRef });
    await db(`insert into "Interests"("senderId","receiverId") values($1,$2)`, [T.userId, X.userId]);
    const list = (await POST('/shortlists', tok, { name: 'My Favourites' })).body;
    const add = await PUT(`/shortlists/${list.id}/profiles/${Bx.profileRef}`, tok, undefined);
    await db(`insert into "KycVerifications"("userId",status,"providerSessionId","documentType","idNumberEncrypted","idNumberLast4") values($1,'needsReview',$2,'aadhaar','ENCRYPTED-BLOB-987654321098','1098')`, [X.userId, `ps-${TAG}`]);
    xReq = await POST('/account/export-request', tok, { password: PW });
    const g = seen('GET /account/export/{requestId}', await GET(`/account/export/${xReq.body?.requestId}`, tok));
    archive = g.body; archiveText = g.text;
    const hash = (await row(`select "passwordHash" h from "Users" where id=$1`, [X.userId])).h;
    const sessionTokens = [xLogin.refreshToken, xLogin.token, hash, 'passwordHash', 'refreshToken', 'ENCRYPTED-BLOB', '987654321098', 'idNumberEncrypted', Bx.email, Bx.mobileNumber, Bx.userId, 'Secretsurname', T.email, T.userId];
    const leaked = sessionTokens.filter((v) => v && archiveText.includes(v));
    const shape = archive?.consents?.length > 0 && Array.isArray(archive?.interests?.sent) && Array.isArray(archive?.interests?.received)
      && archive.interests.sent.length === 1 && archive.interests.received.length === 1
      && archive.shortlists?.some((l) => l.name === 'My Favourites' && l.profiles.some((p) => p.profileRef === Bx.profileRef))
      && archive.shortlists?.some((l) => l.isDefault === true || l.name === 'Shortlisted' || l.name === 'My Favourites')
      && archive.account != null && archive.verification?.idNumberLast4 === '1098';
    return [interest.status === 201 && add.status === 200 && xReq.status === 202 && g.status === 200 && shape && leaked.length === 0,
      `interest ${interest.status}, shortlist add ${add.status}, export GET ${g.status}; top keys=${Object.keys(archive ?? {})}; consents=${archive?.consents?.length}; sent=${archive?.interests?.sent?.length} received=${archive?.interests?.received?.length}; lists=${JSON.stringify(archive?.shortlists?.map((l) => [l.name, l.profiles.length]))}; verification=${JSON.stringify(archive?.verification)}; forbidden strings found=${JSON.stringify(leaked)}`];
  });
  await check('AC4-raw-json-key-scan', async () => {
    const keys = new Set();
    (function walk(v) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); } })(archive);
    // email/mobile keys exist only inside the member's own account block (own data); every other occurrence would be a leak
    const others = JSON.stringify({ ...archive, account: undefined });
    const bad = [...keys].filter((k) => /password|hash|token|session|idnumberencrypted/i.test(k));
    if (/"(email|mobile|phone)"/i.test(others)) bad.push('email/mobile key outside account block');
    const own = archiveText.includes(X.email);
    return [bad.length === 0, `forbidden-looking keys=${JSON.stringify(bad)}; own email in archive=${own} (own data, allowed); all keys=${[...keys].slice(0, 80).join(',')}`];
  });
  await check('AC4-401-404-malformed', async () => {
    const rid = xReq.body?.requestId;
    const n = seen('GET /account/export/{requestId}', await GET(`/account/export/${rid}`));
    const other = seen('GET /account/export/{requestId}', await GET(`/account/export/${rid}`, B.token));
    const unknown = await GET(`/account/export/${randomUUID()}`, xLogin.token);
    const malformed = await GET('/account/export/not-a-uuid', xLogin.token);
    return [n.status === 401 && other.status === 404 && other.body?.code === 'EXPORT_NOT_FOUND' && !other.text.includes('Xavier') && unknown.status === 404 && malformed.status === 404,
      `no token ${n.status}; member B ${other.status} ${other.body?.code}; unknown uuid ${unknown.status}; malformed ${malformed.status}`];
  });
  let statusAfterGet; let secondAfterDownload;
  await check('AC4-assumption-status-after-GET-and-immediate-second-request', async () => {
    statusAfterGet = (await row(`select status from "AccountExportRequests" where id=$1`, [xReq.body?.requestId])).status;
    const again = await GET(`/account/export/${xReq.body?.requestId}`, xLogin.token);
    secondAfterDownload = await POST('/account/export-request', xLogin.token, { password: PW });
    return [statusAfterGet === 'ready' && again.status === 200 && again.text === archiveText && secondAfterDownload.status === 202,
      `DB status after GET=${statusAfterGet}; repeat GET ${again.status} identical body=${again.text === archiveText}; immediate new export-request after download -> ${secondAfterDownload.status}`];
  });
  await check('AC4-expired-410', async () => {
    const rid = xReq.body?.requestId;
    await db(`update "AccountExportRequests" set "expiresAt"=now() - interval '1 second' where id=$1`, [rid]);
    const r = seen('GET /account/export/{requestId}', await GET(`/account/export/${rid}`, xLogin.token));
    const fresh = await POST('/account/export-request', xLogin.token, { password: PW });
    return [r.status === 410 && r.body?.code === 'EXPORT_EXPIRED', `expired -> ${r.status} ${r.text.slice(0, 200)}; (a new request is then possible: ${fresh.status} ${fresh.body?.code ?? ''})`];
  });

  // =================================================================== AC5
  const D = await approvedMember('female', 'Delta Deleter');
  const O = await approvedMember('male', 'Oscar Observer');
  let del; let beforeD; let dLogin;
  await check('AC5-wrong-password-403-no-state', async () => {
    dLogin = await login(D);
    const r = seen('POST /account/delete-request', await POST('/account/delete-request', dLogin.token, { password: 'Wrong-pass1' }));
    const st = await row(`select "deletionRequestedAt" a, "deletionScheduledPurgeAt" b from "Users" where id=$1`, [D.userId]);
    const nope = seen('POST /account/delete-request', await POST('/account/delete-request', undefined, { password: PW }));
    return [r.status === 403 && r.body?.code === 'STEP_UP_FAILED' && st.a === null && st.b === null && nope.status === 401, `wrong -> ${r.status} ${r.body?.code}; db dates=${st.a},${st.b}; no token ${nope.status}`];
  });
  await check('AC5-baseline-visible', async () => {
    const oTok = (await login(O)).token;
    O.tok = oTok;
    await db(`delete from "Interests" where "senderId"=$1 and "receiverId"=$2`, [D.userId, O.userId]);
    const i = await POST('/interests', dLogin.token, { receiverProfileRef: O.profileRef });
    const lists = (await GET('/shortlists', oTok)).body;
    O.listId = lists[0].id;
    const sl = await PUT(`/shortlists/${O.listId}/profiles/${D.profileRef}`, oTok, undefined);
    const search = await GET(`/discovery/search?city=${TAG}`, oTok);
    const detail = await GET(`/profiles/${D.profileRef}`, oTok);
    const recv = await GET('/interests/received', oTok);
    const inSearch = search.text.includes(D.profileRef);
    const inRecv = recv.text.includes(D.profileRef);
    beforeD = await row(`select "accountStatus" s, "profileReviewStatus" r from "Users" where id=$1`, [D.userId]);
    return [i.status === 201 && sl.status === 200 && search.status === 200 && inSearch && detail.status === 200 && inRecv,
      `interest D->O ${i.status}; O shortlist add ${sl.status}; O search ${search.status} contains D=${inSearch}; detail ${detail.status}; O received contains D=${inRecv}; D status=${JSON.stringify(beforeD)}`];
  });
  await check('AC5-correct-202-schedule-30-days', async () => {
    const t0 = Date.now();
    del = seen('POST /account/delete-request', await POST('/account/delete-request', dLogin.token, { password: PW }));
    const t1 = Date.now();
    const sched = new Date(del.body?.scheduledPurgeAt).getTime();
    const st = await row(`select "deletionRequestedAt" a, "deletionScheduledPurgeAt" b from "Users" where id=$1`, [D.userId]);
    const days = (st.b - st.a) / 86400000;
    return [del.status === 202 && del.body?.status === 'pending' && sched >= t0 + 30 * 86400000 - 1000 && sched <= t1 + 30 * 86400000 + 1000 && Math.abs(days - 30) < 0.001 && new Date(st.b).toISOString() === del.body.scheduledPurgeAt,
      `-> ${del.status} ${del.text}; db requested=${st.a?.toISOString()} purge=${st.b?.toISOString()} diff days=${days}`];
  });
  await check('AC5-absent-from-discovery-search-detail-interest-shortlist-lists', async () => {
    const o = O.tok;
    const search = await GET(`/discovery/search?city=${TAG}`, o);
    const recs = await GET('/discovery/recommendations', o);
    const detail = await GET(`/profiles/${D.profileRef}`, o);
    const send = await POST('/interests', o, { receiverProfileRef: D.profileRef });
    const sl = await GET(`/shortlists/${O.listId}/profiles`, o);
    const putSl = await PUT(`/shortlists/${O.listId}/profiles/${D.profileRef}`, o, undefined);
    const recv = await GET('/interests/received', o);
    const sent = await GET('/interests/sent', o);
    const unknown = await GET(`/profiles/${'f'.repeat(32)}`, o);
    const unknownSend = await POST('/interests', o, { receiverProfileRef: 'f'.repeat(32) });
    const hidden = [search, recs, sl, recv, sent].map((r) => !r.text.includes(D.profileRef) && !r.text.includes('Delta'));
    return [search.status === 200 && recs.status === 200 && sl.status === 200 && recv.status === 200 && hidden.every(Boolean)
      && detail.status === 404 && send.status === 404 && send.body?.code === 'PROFILE_NOT_FOUND' && putSl.status === 404
      && detail.text.replace(/"requestId":"[^"]*"/, '') === unknown.text.replace(/"requestId":"[^"]*"/, '') && send.body?.code === unknownSend.body?.code,
    `O search ${search.status}, recommendations ${recs.status}, shortlist listing ${sl.status}, received ${recv.status}, sent ${sent.status}; none mention D=${hidden}; detail ${detail.status} (same body as unknown ref=${detail.text.replace(/"requestId":"[^"]*"/, '') === unknown.text.replace(/"requestId":"[^"]*"/, '')}); send ${send.status} ${send.body?.code}; shortlist add ${putSl.status} ${putSl.body?.code}`];
  });
  await check('AC5-pending-member-routes-403-with-date', async () => {
    const d = dLogin.token;
    const lg = await login(D);
    const routes = [
      ['GET', '/account/settings'], ['PATCH', '/account/settings', { language: 'hi' }], ['POST', '/account/logout-all'], ['POST', '/account/export-request', { password: PW }],
      ['GET', `/account/export/${randomUUID()}`], ['POST', '/account/delete-request', { password: PW }], ['GET', '/profiles/me'], ['GET', '/discovery/search'], ['GET', '/discovery/recommendations'],
      ['GET', '/interests/sent'], ['GET', '/interests/received'], ['POST', '/interests', { receiverProfileRef: O.profileRef }], ['GET', '/shortlists'], ['POST', '/shortlists', { name: 'zzz' }],
      ['GET', '/consents/current'],
    ];
    const refreshWhilePending = await call(baseUrl, 'POST', '/auth/refresh', { body: { refreshToken: lg.refreshToken } });
    const results = [];
    for (const [m, p, b] of routes) {
      const r = await call(baseUrl, m, p, { token: lg.token, body: b });
      results.push([`${m} ${p.replace(/[0-9a-f-]{36}/, '{id}')}`, r.status, r.body?.code, r.body?.details?.scheduledPurgeAt]);
    }
    const allBlocked = results.every(([, s, c, d2]) => s === 403 && c === 'ACCOUNT_DELETION_PENDING' && d2 === del.body?.scheduledPurgeAt);
    return [lg.status === 200 && allBlocked, `login while pending -> ${lg.status}; ${results.map((x) => x.slice(0, 3).join(' ')).join(' | ')}; POST /auth/refresh (public, informational) -> ${refreshWhilePending.status}; details.scheduledPurgeAt equals the scheduled date on every blocked route=${allBlocked}`];
  });
  await check('AC5-logout-allowed-and-admin-paths-404', async () => {
    const lg = await login(D);
    const adminPaths = [['GET', '/admin/account-deletions'], ['POST', '/admin/account-deletions'], ['DELETE', '/admin/account-deletions/' + D.userId], ['POST', `/admin/users/${D.userId}/delete`], ['POST', `/admin/accounts/${D.userId}/purge`], ['GET', `/admin/profiles/${D.userId}/deletion`]];
    const rs = [];
    for (const [m, p] of adminPaths) {
      const withTok = await call(baseUrl, m, p, { token: lg.token, body: m === 'GET' ? undefined : {} });
      const none = await call(baseUrl, m, p, {});
      rs.push(`${m} ${p.replace(D.userId, '{id}')} -> member ${withTok.status}, anon ${none.status}`);
    }
    const lo = await POST('/auth/logout', lg.token, undefined);
    return [(lo.status === 200 || lo.status === 201) && rs.every((s) => /member 404, anon 404/.test(s)), `POST /auth/logout while pending -> ${lo.status} ${lo.text.slice(0, 100)}; ${rs.join('; ')}`];
  });
  await check('AC5-second-delete-request-while-pending', async () => {
    const lg = await login(D);
    const r = await POST('/account/delete-request', lg.token, { password: PW });
    const st = await row(`select "deletionScheduledPurgeAt" b from "Users" where id=$1`, [D.userId]);
    return [r.status === 403 || r.status === 409 && st.b.toISOString() === del.body.scheduledPurgeAt, `second delete-request -> ${r.status} ${r.body?.code}; schedule unchanged=${st.b.toISOString() === del.body.scheduledPurgeAt}`];
  });

  // =================================================================== AC6
  await check('AC6-cancel-restores-everything', async () => {
    const lg = await login(D);
    const r = seen('DELETE /account/delete-request', await DEL('/account/delete-request', lg.token));
    const after = await row(`select "accountStatus" s, "profileReviewStatus" r, "deletionRequestedAt" a, "deletionScheduledPurgeAt" b from "Users" where id=$1`, [D.userId]);
    const search = await GET(`/discovery/search?city=${TAG}`, O.tok);
    const detail = await GET(`/profiles/${D.profileRef}`, O.tok);
    const recv = await GET('/interests/received', O.tok);
    const sl = await GET(`/shortlists/${O.listId}/profiles`, O.tok);
    const settings = await GET('/account/settings', lg.token);
    const again = seen('DELETE /account/delete-request', await DEL('/account/delete-request', lg.token));
    return [r.status === 200 && after.s === beforeD.s && after.r === beforeD.r && after.a === null && after.b === null && search.text.includes(D.profileRef) && detail.status === 200
      && recv.text.includes(D.profileRef) && sl.text.includes(D.profileRef) && settings.status === 200 && again.status === 404 && again.body?.code === 'DELETE_REQUEST_NOT_FOUND',
    `cancel -> ${r.status} ${r.text}; status ${before(beforeD)} -> ${before(after)}; O search contains D=${search.text.includes(D.profileRef)}, detail ${detail.status}, received contains D=${recv.text.includes(D.profileRef)}, shortlist contains D=${sl.text.includes(D.profileRef)}; D settings ${settings.status}; cancel again -> ${again.status} ${again.body?.code}`];
    function before(o) { return `${o.s}/${o.r}`; }
  });
  await check('AC6-cancel-no-token-401', async () => {
    const r = await DEL('/account/delete-request', undefined);
    return [r.status === 401, `-> ${r.status}`];
  });
  await check('AC6-cancel-after-boundary-410', async () => {
    const lg = await login(D);
    await POST('/account/delete-request', lg.token, { password: PW });
    await db(`update "Users" set "deletionRequestedAt"=now()-interval '30 days 1 minute', "deletionScheduledPurgeAt"=now()-interval '1 minute' where id=$1`, [D.userId]);
    const r = seen('DELETE /account/delete-request', await DEL('/account/delete-request', lg.token));
    const st = await row(`select "deletionScheduledPurgeAt" b from "Users" where id=$1`, [D.userId]);
    // exactly-on-boundary: cannot be hit precisely over HTTP; one second in the past is the closest deterministic check
    return [r.status === 410 && r.body?.code === 'ACCOUNT_PURGED' && st.b !== null, `-> ${r.status} ${r.text.slice(0, 200)}; deletion still scheduled=${st.b !== null}`];
  });

  // ---- purge
  const P = await approvedMember('female', 'Papa Purged');
  const Q = await approvedMember('male', 'Quebec Kept');
  const adminId = randomUUID();
  await db(`insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus","profileReviewStatus",gender)
            values($1,'Audit Admin',$2,'x',$3,'admin','active','approved','male')`, [adminId, `adm-${adminId}@example.test`, `7${String(randomInt(0, 999999999)).padStart(9, '0')}`]);
  const referencing = async (userId, profileId) => {
    const fks = (await db(`select c.conrelid::regclass::text tbl, a.attname col, c.confrelid::regclass::text ref
      from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
      where c.contype='f' and c.confrelid in ('"Users"'::regclass,'"Profiles"'::regclass)`)).rows;
    const res = {};
    for (const f of fks) {
      const v = f.ref === '"Users"' ? userId : profileId;
      const n = (await db(`select count(*)::int n from ${f.tbl} where "${f.col}"=$1`, [v])).rows[0].n;
      if (n > 0) res[`${f.tbl}.${f.col}`] = n;
    }
    const users = (await db(`select count(*)::int n from "Users" where id=$1`, [userId])).rows[0].n;
    if (users) res['"Users".id'] = users;
    return res;
  };
  let pLogin; let pre; let consentsBefore;
  await check('AC6-purge-seed', async () => {
    pLogin = await login(P);
    const qTok = (await login(Q)).token;
    await POST('/interests', pLogin.token, { receiverProfileRef: Q.profileRef });
    await db(`insert into "Interests"("senderId","receiverId") values($1,$2)`, [Q.userId, P.userId]);
    const ql = (await GET('/shortlists', qTok)).body[0];
    await PUT(`/shortlists/${ql.id}/profiles/${P.profileRef}`, qTok, undefined);
    await GET('/shortlists', pLogin.token);
    await db(`insert into "KycVerifications"("userId",status,"providerSessionId","documentType","idNumberEncrypted","idNumberLast4") values($1,'needsReview',$2,'aadhaar','enc','1234')`, [P.userId, `pp-${TAG}`]);
    await db(`insert into "Notifications"("userId",type,title,body) values($1,(enum_range(null::"NotificationType"))[1],'t','b')`, [P.userId]);
    await db(`insert into "ProfileViews"("viewerId","viewedId") values($1,$2),($2,$1)`, [Q.userId, P.userId]);
    await db(`insert into "StepUpFailures"("userId") values($1)`, [P.userId]);
    await POST('/account/export-request', pLogin.token, { password: PW });
    await db(`insert into "AdminAuditLog"("adminId",action,"targetId","relatedId",notes,"ipAddress","userAgent","reasonCode") values($1,'APPROVE_PROFILE',$2,$2,'sensitive note about Papa','203.0.113.9','UA-secret','ok')`, [adminId, P.userId]);
    await db(`insert into "AdminAuditLog"("adminId",action,"targetId",notes) values($1,'APPROVE_PROFILE',$2,'unrelated')`, [adminId, Q.userId]);
    await POST('/account/delete-request', pLogin.token, { password: PW });
    pre = await referencing(P.userId, P.profileId);
    consentsBefore = (await row(`select count(*)::int n from "ConsentRecords" where "userId"=$1`, [P.userId])).n;
    const tables = Object.keys(pre);
    return [tables.length >= 10 && consentsBefore > 0, `rows before purge by table.column=${JSON.stringify(pre)}; ConsentRecords=${consentsBefore}`];
  });
  // The known pg pool connection-timeout flake can hit the CLI too; retry only when the DB connection itself failed.
  const runPurge = () => {
    let r;
    for (let i = 1; i <= 3; i++) {
      r = spawnSync('npm', ['--prefix', BACKEND_DIR, 'run', 'account:purge'], { env: { ...process.env, DATABASE_URL: TEST_DB }, encoding: 'utf8', shell: true });
      if (r.status === 0 || !/connection timeout|initial ping failed/i.test(r.stdout + r.stderr)) { r.attempts = i; return r; }
    }
    r.attempts = 3;
    return r;
  };
  await check('AC6-purge-day-before-removes-nothing', async () => {
    // member D (left due by the 410 check above) must not count in this run; clear it, it is test data
    await db(`update "Users" set "deletionRequestedAt"=null, "deletionScheduledPurgeAt"=null where id=$1`, [D.userId]);
    await db(`update "Users" set "deletionRequestedAt"=now()-interval '29 days', "deletionScheduledPurgeAt"=now()+interval '1 day' where id=$1`, [P.userId]);
    const r = runPurge();
    const post = await referencing(P.userId, P.profileId);
    return [r.status === 0 && /Account purge finished: 0 purged, 0 failed/.test(r.stdout) && JSON.stringify(post) === JSON.stringify(pre),
      `exit ${r.status}; stdout=${r.stdout.trim().split('\n').pop()}; rows unchanged=${JSON.stringify(post) === JSON.stringify(pre)}`];
  });
  await check('AC6-purge-at-boundary-removes-member-rows', async () => {
    // the stored time is moved to 1 second in the past (CLI uses the real clock); the service spec covers the inclusive boundary
    await db(`update "Users" set "deletionScheduledPurgeAt"=now()-interval '1 second' where id=$1`, [P.userId]);
    const r = runPurge();
    const post = await referencing(P.userId, P.profileId);
    const qStill = await row(`select count(*)::int n from "Users" where id=$1`, [Q.userId]);
    const qList = await GET('/shortlists', (await login(Q)).token);
    const qInterests = await row(`select count(*)::int n from "Interests" where "senderId"=$1 or "receiverId"=$1`, [Q.userId]);
    return [r.status === 0 && /Account purge finished: [1-9]\d* purged, 0 failed/.test(r.stdout) && JSON.stringify(post) === '{}' && qStill.n === 1 && qList.status === 200,
      `exit ${r.status}; stdout=${r.stdout.trim().split('\n').pop()}; remaining referencing rows for P=${JSON.stringify(post)}; member Q intact=${qStill.n}, Q /shortlists ${qList.status}, Q interests rows=${qInterests.n}; stderr=${r.stderr.slice(-200)}`];
  });
  await check('AC6-purge-retained-evidence-anonymised', async () => {
    const c = (await db(`select "userId","userName",ip,"userAgent",code,version,"documentHash","textSnapshot","grantedAt" from "ConsentRecords" where "userName"='' and "userId" is null and "documentHash" is not null`)).rows;
    const cNullCount = (await row(`select count(*)::int n from "ConsentRecords" where "userId" is null`)).n;
    const a = (await db(`select "targetId","relatedId",notes,"ipAddress","userAgent",action,"reasonCode","adminId" from "AdminAuditLog" where "adminId"=$1 order by "createdAt"`, [adminId])).rows;
    const mine = a.find((x) => x.action === 'APPROVE_PROFILE' && x.reasonCode === 'ok');
    const unrelated = a.find((x) => x.reasonCode === null);
    const anyLeft = (await row(`select count(*)::int n from "ConsentRecords" where "userName" ilike '%Papa%'`)).n;
    return [cNullCount >= consentsBefore && anyLeft === 0 && c.every((x) => x.ip === '' && x.userAgent === '' && x.textSnapshot) && a.length === 2 && mine && mine.targetId === null && mine.relatedId === null && mine.notes === null && mine.ipAddress === null && mine.userAgent === null && unrelated?.notes === 'unrelated' && unrelated.targetId === Q.userId,
      `ConsentRecords with userId NULL=${cNullCount} (member had ${consentsBefore}); rows still naming 'Papa'=${anyLeft}; sample=${JSON.stringify(c[0] && { userName: c[0].userName, ip: c[0].ip, userAgent: c[0].userAgent, code: c[0].code, textSnapshot: !!c[0].textSnapshot })}; AdminAuditLog rows for admin=${a.length}; P's row=${JSON.stringify(mine)}; Q's row untouched targetId==Q=${unrelated?.targetId === Q.userId} notes=${unrelated?.notes}`];
  });
  await check('AC6-consent-append-only-still-enforced', async () => {
    const id = (await row(`select id from "ConsentRecords" where "userId" is null limit 1`)).id;
    const tries = {};
    for (const [k, sql] of Object.entries({
      updateCode: `update "ConsentRecords" set code='X' where id='${id}'`,
      updateRevoked: `update "ConsentRecords" set "revokedAt"=now() where id='${id}'`,
      reattachUser: `update "ConsentRecords" set "userId"='${Q.userId}' where id='${id}'`,
      delete: `delete from "ConsentRecords" where id='${id}'`,
    })) {
      try { await db(sql); tries[k] = 'ALLOWED'; } catch (e) { tries[k] = e.message.includes('CONSENT_RECORDS_APPEND_ONLY') ? 'CONSENT_RECORDS_APPEND_ONLY' : e.message.slice(0, 60); }
    }
    const qUpd = await (async () => { const qid = (await row(`select id from "ConsentRecords" where "userId"=$1 limit 1`, [Q.userId])).id; try { await db(`update "ConsentRecords" set "userName"='',ip='',"userAgent"='' where id='${qid}'`); return 'ALLOWED'; } catch (e) { return e.message.includes('CONSENT_RECORDS_APPEND_ONLY') ? 'CONSENT_RECORDS_APPEND_ONLY' : e.message.slice(0, 80); } })();
    return [Object.values(tries).every((v) => v === 'CONSENT_RECORDS_APPEND_ONLY'), `${JSON.stringify(tries)}; anonymising shape on a LIVE member's row via raw SQL -> ${qUpd} (informational)`];
  });
  await check('AC6-purged-member-token-and-login-dead', async () => {
    const t = await GET('/account/settings', pLogin.token);
    const l = await login(P);
    return [t.status === 401 && l.status === 401, `old access token -> ${t.status}; login -> ${l.status}`];
  });
  await check('AC6-purge-rerun-idempotent', async () => {
    const r = runPurge();
    return [r.status === 0 && /0 purged, 0 failed/.test(r.stdout), `second run: exit ${r.status}; ${r.stdout.trim().split('\n').pop()}`];
  });

  // =================================================================== AC7
  await check('AC7-openapi-field-by-field', async () => {
    if (!yaml) return [false, 'js-yaml not available'];
    const spec = yaml.parse(readFileSync(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8'));
    const ops = [['/account/settings', 'get'], ['/account/settings', 'patch'], ['/account/logout-all', 'post'], ['/account/export-request', 'post'], ['/account/export/{requestId}', 'get'], ['/account/delete-request', 'post'], ['/account/delete-request', 'delete']];
    const missing = [];
    const summary = [];
    for (const [p, m] of ops) {
      const op = spec.paths?.[p]?.[m];
      if (!op) { missing.push(`${m} ${p}`); continue; }
      const codes = Object.keys(op.responses ?? {});
      const secured = JSON.stringify(op.security ?? spec.security ?? []).includes('ear');
      summary.push(`${m} ${p}: ${codes.join('/')} sec=${secured}`);
      const obs = observed[`${m.toUpperCase()} ${p}`];
      if (obs) for (const s of obs) if (!codes.includes(String(s)) && !(s === 401 || s === 400 || s === 403 || s === 429 || s === 404) ) missing.push(`${m} ${p} status ${s} undocumented`);
      if (obs) for (const s of obs) if (!codes.includes(String(s)) && ['400', '401', '403', '404', '409', '410', '429'].includes(String(s))) missing.push(`${m} ${p} observed ${s} not in documented ${codes}`);
    }
    const txt = readFileSync(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8');
    const schemas = spec.components?.schemas ?? {};
    const stepUp = schemas.StepUpRequest;
    const wantCodes = ['STEP_UP_FAILED', 'RATE_LIMITED', 'REQUEST_ALREADY_PENDING', 'ACCOUNT_PURGED', 'ACCOUNT_DELETION_PENDING', 'EXPORT_EXPIRED', 'EXPORT_NOT_FOUND', 'DELETE_REQUEST_NOT_FOUND'];
    const codesMissing = wantCodes.filter((c) => !txt.includes(c));
    const envelope = txt.includes('ErrorEnvelope');
    return [missing.length === 0 && stepUp?.properties?.password && (stepUp.required ?? []).includes('password') && codesMissing.length === 0 && envelope,
      `ops: ${summary.join(' | ')}; undocumented-or-missing=${JSON.stringify(missing)}; StepUpRequest=${JSON.stringify(stepUp)}; codes absent from yaml=${JSON.stringify(codesMissing)}; ErrorEnvelope referenced=${envelope}; schema names=${Object.keys(schemas).filter((k) => /Account|Settings|Export|Deletion|StepUp|Notif/i.test(k))}`];
  });

  // =================================================================== iteration 2 (verdict round 1 fixes)
  const tokensOf = (r) => r.body?.tokens ?? r.body ?? {};
  const asTx = async (fn) => {
    await db('begin');
    try { return await fn(); } finally { await db('rollback').catch(() => {}); }
  };

  await check('IT2-control-8-parallel-authenticated-GETs-no-step-up', async () => {
    // control for the race row below: same burst size, no advisory lock, no bcrypt
    const W = await approvedMember('male', 'Burst Control');
    const rs = await Promise.all(Array.from({ length: 8 }, () => GET('/account/settings', W.token)));
    return [rs.every((r) => r.status === 200), `8 parallel GET /account/settings -> ${rs.map((r) => r.status)}`];
  });
  await check('IT2-step-up-race-8-parallel-wrong-passwords', async () => {
    const W = await approvedMember('male', 'Race Stepup');
    const V = await approvedMember('male', 'Race Sibling');
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => POST('/account/export-request', W.token, { password: `Wrong-race${i}` })));
    const c403 = rs.filter((r) => r.status === 403).length;
    const c429 = rs.filter((r) => r.status === 429).length;
    const rows = await row(`select count(*)::int n from "StepUpFailures" where "userId"=$1`, [W.userId]);
    const right = await POST('/account/export-request', W.token, { password: PW });
    const rightDel = await POST('/account/delete-request', W.token, { password: PW });
    const exp = await row(`select count(*)::int n from "AccountExportRequests" where "userId"=$1`, [W.userId]);
    const sib = await POST('/account/export-request', V.token, { password: PW });
    return [c403 === 5 && c429 === 3 && rows.n === 5 && right.status === 429 && rightDel.status === 429 && exp.n === 0 && sib.status === 202,
      `8 parallel wrong -> 403 x${c403}, 429 x${c429} (statuses ${rs.map((r) => r.status)}); StepUpFailures rows=${rows.n}; right export -> ${right.status}; right delete -> ${rightDel.status}; export rows=${exp.n}; sibling right password -> ${sib.status}`];
  });

  await check('IT2-logout-all-racing-refresh-no-token-survives', async () => {
    const N = 6;
    const detail = [];
    let bad = 0;
    for (let i = 0; i < N; i++) {
      const lg = await login(L);
      const delayMs = [0, 50, 150, 300, 500, 800][i % 6]; // staggered so the refresh sometimes wins, sometimes loses
      const [ref, lo] = await Promise.all([POST('/auth/refresh', undefined, { refreshToken: lg.refreshToken }),
        new Promise((r) => setTimeout(r, delayMs)).then(() => POST('/account/logout-all', lg.token, undefined))]);
      const t = tokensOf(ref);
      const acc = t.accessToken ? await GET('/account/settings', t.accessToken) : null;
      const ref2 = t.refreshToken ? await POST('/auth/refresh', undefined, { refreshToken: t.refreshToken }) : null;
      const oldAcc = await GET('/account/settings', lg.token);
      const survived = (acc && acc.status === 200) || (ref2 && (ref2.status === 200 || ref2.status === 201)) || oldAcc.status === 200;
      if (survived || lo.status !== 200) bad++;
      detail.push(`#${i} (logout-all +${delayMs}ms): refresh ${ref.status}, logout-all ${lo.status}, raced access ${acc?.status ?? '-'}, raced refresh ${ref2?.status ?? '-'}, original access ${oldAcc.status}`);
    }
    return [bad === 0, `${N} races, tokens accepted after both completed=${bad}; ${detail.join(' | ')}`];
  });

  await check('IT2-sv-claim-after-logout-all-login-and-refresh', async () => {
    const lg = await login(L);
    const svDb = (await row(`select "sessionVersion" v from "Users" where id=$1`, [L.userId])).v;
    const claims = b64(lg.token);
    const rcl = b64(lg.refreshToken);
    const rf = await POST('/auth/refresh', undefined, { refreshToken: lg.refreshToken });
    const t = tokensOf(rf);
    const rfClaims = t.accessToken ? b64(t.accessToken) : {};
    const ok = await GET('/account/settings', t.accessToken);
    return [lg.status === 200 && svDb >= 1 && claims.sv === svDb && rcl.sv === svDb && (rf.status === 200 || rf.status === 201) && rfClaims.sv === svDb && ok.status === 200,
      `Users.sessionVersion=${svDb}; login access sv=${claims.sv}, refresh sv=${rcl.sv}; refreshed access sv=${rfClaims.sv}, refresh -> ${rf.status}, refreshed token works ${ok.status}`];
  });

  await check('IT2-second-delete-request-contract', async () => {
    const G = await approvedMember('female', 'Twice Deleter');
    const lg = await login(G);
    const first = await POST('/account/delete-request', lg.token, { password: PW });
    const lg2 = await login(G);
    const second = await POST('/account/delete-request', lg2.token, { password: PW });
    const st = await row(`select "deletionScheduledPurgeAt" b from "Users" where id=$1`, [G.userId]);
    const audits = await row(`select count(*)::int n from "AccountAuditLog" where "userId"=$1 and "eventType"='deletion_requested'`, [G.userId]);
    // parallel first requests on a fresh member: idempotent, one schedule, one audit row
    const H = await approvedMember('female', 'Parallel Deleter');
    const hl = await login(H);
    const par = await Promise.all([POST('/account/delete-request', hl.token, { password: PW }), POST('/account/delete-request', hl.token, { password: PW })]);
    const hAud = await row(`select count(*)::int n from "AccountAuditLog" where "userId"=$1 and "eventType"='deletion_requested'`, [H.userId]);
    const hSt = await row(`select "deletionScheduledPurgeAt" b from "Users" where id=$1`, [H.userId]);
    const okPar = par.every((r) => r.status === 202 || r.status === 403) && par.some((r) => r.status === 202)
      && par.filter((r) => r.status === 202).every((r) => r.body?.scheduledPurgeAt === hSt.b.toISOString());
    // clean up: leave no pending deletion behind (Backend itests purge with a far-future clock and would pick these up)
    await DEL('/account/delete-request', (await login(G)).token);
    await DEL('/account/delete-request', (await login(H)).token);
    let docs = 'yaml unavailable';
    let docsOk = false;
    if (yaml) {
      const spec = yaml.parse(readFileSync(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8'));
      const del = Object.keys(spec.paths['/account/delete-request'].post.responses);
      const exp = Object.keys(spec.paths['/account/export-request'].post.responses);
      docsOk = !del.includes('409') && exp.includes('409');
      docs = `openapi delete-request post=${del}; export-request post=${exp}`;
    }
    return [first.status === 202 && second.status !== 409 && (second.status === 403 || second.status === 202) && st.b.toISOString() === first.body?.scheduledPurgeAt && audits.n === 1 && okPar && hAud.n === 1 && docsOk,
      `first ${first.status}; second ${second.status} ${second.body?.code}; schedule unchanged=${st.b.toISOString() === first.body?.scheduledPurgeAt}; deletion_requested audit rows=${audits.n}; 2 parallel -> ${par.map((r) => r.status)} audit rows=${hAud.n}; ${docs}`];
  });

  // consent guard on a live member
  const consentSnap = async (uid) => (await db(`select md5(string_agg(t::text, '|' order by t.id::text)) h, count(*)::int n from "ConsentRecords" t where "userId"=$1`, [uid])).rows[0];
  await check('IT2-consent-rows-unchanged-by-export-delete-cancel', async () => {
    const C = await approvedMember('male', 'Consent Keeper');
    const lg = await login(C);
    const s0 = await consentSnap(C.userId);
    await POST('/account/export-request', lg.token, { password: PW });
    const s1 = await consentSnap(C.userId);
    const d = await POST('/account/delete-request', lg.token, { password: PW });
    const s2 = await consentSnap(C.userId);
    const lg2 = await login(C);
    const c = await DEL('/account/delete-request', lg2.token);
    const s3 = await consentSnap(C.userId);
    return [s0.n > 0 && s0.h === s1.h && s1.h === s2.h && s2.h === s3.h && d.status === 202 && c.status === 200,
      `rows=${s0.n}; hash before=${s0.h}, after export=${s1.h}, after delete-request(${d.status})=${s2.h}, after cancel(${c.status})=${s3.h}`];
  });
  await check('IT2-consent-direct-updates-refused-except-permitted-purge-shape', async () => {
    const C = await approvedMember('male', 'Consent Guarded');
    const lg = await login(C);
    const id = (await row(`select id from "ConsentRecords" where "userId"=$1 limit 1`, [C.userId])).id;
    const anon = `update "ConsentRecords" set "userId"=null,"userName"='',ip='',"userAgent"='' where id='${id}'`;
    const attempt = async (sql, pre) => asTx(async () => {
      try { if (pre) await db(pre); await db(sql); return 'ALLOWED'; } catch (e) { return e.message.includes('CONSENT_RECORDS_APPEND_ONLY') ? 'REFUSED' : `other:${e.message.slice(0, 60)}`; }
    });
    const setting = `select set_config('app.purge_user_id','${C.userId}',true)`;
    const liveNoSetting = await attempt(anon);
    const liveWithSetting = await attempt(anon, setting); // live member: no schedule
    await POST('/account/delete-request', lg.token, { password: PW });
    const pendingNoSetting = await attempt(anon);
    const pendingWithSetting = await attempt(anon, setting); // the permitted purge shape (rolled back)
    const pendingOtherShape = await attempt(`update "ConsentRecords" set code='X' where id='${id}'`, setting);
    const del = await attempt(`delete from "ConsentRecords" where id='${id}'`, setting);
    const still = await row(`select "userId" from "ConsentRecords" where id=$1`, [id]);
    const lg2 = await login(C);
    await DEL('/account/delete-request', lg2.token);
    return [liveNoSetting === 'REFUSED' && liveWithSetting === 'REFUSED' && pendingNoSetting === 'REFUSED' && pendingWithSetting === 'ALLOWED' && pendingOtherShape === 'REFUSED' && del === 'REFUSED' && still.userId === C.userId,
      `live/no setting=${liveNoSetting}; live/with setting=${liveWithSetting}; pending/no setting=${pendingNoSetting}; pending/with setting (permitted purge shape, rolled back)=${pendingWithSetting}; pending+setting other column=${pendingOtherShape}; delete=${del}; row still linked=${still.userId === C.userId}`];
  });

  // AccountAuditLog end to end
  await check('IT2-account-audit-log-lifecycle-and-purge', async () => {
    const Z = await approvedMember('female', 'Zulu Audited');
    const adminBefore = (await db(`select md5(string_agg(t::text,'|' order by t.id::text)) h, count(*)::int n from "AdminAuditLog" t where "adminId"=$1`, [adminId])).rows[0];
    const lg = await login(Z);
    const er = await POST('/account/export-request', lg.token, { password: PW });
    const dl = await GET(`/account/export/${er.body?.requestId}`, lg.token);
    const dr = await POST('/account/delete-request', lg.token, { password: PW });
    const lg2 = await login(Z);
    const dc = await DEL('/account/delete-request', lg2.token);
    const lo = await POST('/account/logout-all', lg2.token, undefined);
    const lg3 = await login(Z);
    const dr2 = await POST('/account/delete-request', lg3.token, { password: PW });
    const rows = (await db(`select id,"eventType","requestId",ip,"userAgent" from "AccountAuditLog" where "userId"=$1 order by "createdAt"`, [Z.userId])).rows;
    const types = rows.map((r) => r.eventType);
    const want = ['export_requested', 'export_downloaded', 'deletion_requested', 'deletion_cancelled', 'logout_all', 'deletion_requested'];
    const sameSet = JSON.stringify([...types].sort()) === JSON.stringify([...want].sort());
    const withUa = rows.every((r) => r.userAgent !== '');
    const ids = rows.map((r) => r.id);
    const tries = {};
    for (const [k, sql] of Object.entries({
      update: `update "AccountAuditLog" set "eventType"='logout_all' where id='${ids[0]}'`,
      updateIp: `update "AccountAuditLog" set ip='x' where id='${ids[0]}'`,
      anonymiseLive: `update "AccountAuditLog" set "userId"=null, ip='', "userAgent"='' where id='${ids[0]}'`,
      delete: `delete from "AccountAuditLog" where id='${ids[0]}'`,
    })) {
      try { await db(sql); tries[k] = 'ALLOWED'; } catch (e) { tries[k] = e.message.includes('ACCOUNT_AUDIT_LOG_APPEND_ONLY') ? 'APPEND_ONLY' : e.message.slice(0, 60); }
    }
    const refused = Object.values(tries).every((v) => v === 'APPEND_ONLY');
    // purge
    await db(`update "Users" set "deletionRequestedAt"=now()-interval '31 days',"deletionScheduledPurgeAt"=now()-interval '1 second' where id=$1`, [Z.userId]);
    const pr = runPurge();
    const after = (await db(`select id,"userId","eventType","requestId",ip,"userAgent","createdAt" from "AccountAuditLog" where id = any($1::uuid[]) order by "createdAt"`, [ids])).rows;
    const kept = after.length === rows.length && after.every((r) => r.userId === null && r.ip === '' && r.userAgent === '');
    const evUnchanged = JSON.stringify(after.map((r) => r.eventType).sort()) === JSON.stringify(types.sort());
    const purgeRows = await row(`select count(*)::int n, bool_and("userId" is null) nolink from "AccountAuditLog" where "eventType"='purge_executed'`);
    const adminAfter = (await db(`select md5(string_agg(t::text,'|' order by t.id::text)) h, count(*)::int n from "AdminAuditLog" t where "adminId"=$1`, [adminId])).rows[0];
    return [er.status === 202 && dl.status === 200 && dr.status === 202 && dc.status === 200 && lo.status === 200 && dr2.status === 202 && sameSet && withUa && refused
      && pr.status === 0 && kept && evUnchanged && purgeRows.n >= 1 && purgeRows.nolink && adminBefore.h === adminAfter.h,
    `actions: export ${er.status}, download ${dl.status}, delete ${dr.status}, cancel ${dc.status}, logout-all ${lo.status}, delete again ${dr2.status}; audit events=${types}; userAgent set on all=${withUa}; UPDATE/DELETE attempts=${JSON.stringify(tries)}; purge exit ${pr.status}; after purge rows kept=${after.length}/${rows.length} with userId null, ip and userAgent cleared=${kept}, event types unchanged=${evUnchanged}; purge_executed rows=${purgeRows.n} (all unlinked=${purgeRows.nolink}); AdminAuditLog hash unchanged=${adminBefore.h === adminAfter.h} (rows ${adminBefore.n}->${adminAfter.n})`];
  });

  return out;
}
