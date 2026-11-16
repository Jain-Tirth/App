/**
 * Phase 1 story 7 - interests: send, accept, decline, withdraw, cooldown,
 * admin cooldown clear, canChat. HTTP + real PostgreSQL (npm --prefix Backend run test:api).
 */
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'Phase 1 story 7 - interests';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(HERE, '..', '..', 'Backend');
const require = createRequire(path.join(BACKEND_DIR, 'package.json'));
const bcrypt = require('bcrypt');
const yaml = (() => { try { const y = require('js-yaml'); return { parse: (t) => y.load(t) }; } catch { return null; } })();

const FORBIDDEN_KEY = /email|mobile|dateofbirth|userid|profileuid|idnumber|document|passwordhash|\bdob\b|phone/i;

async function call(baseUrl, method, p, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(`${baseUrl}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* raw */ }
  return { status: r.status, body: json, text };
}

export async function run({ baseUrl, database }) {
  const out = [];
  const db = (sql, p) => database.query(sql, p);
  const add = (ac, ok, evidence) => out.push({ ac, status: ok ? 'PASS' : 'FAIL', evidence: String(evidence).slice(0, 700) });
  const check = async (ac, fn) => {
    try { const [ok, ev] = await fn(); add(ac, ok, ev); } catch (e) { add(ac, false, `threw ${e.message}`); }
  };
  const TAG = `I${Date.now().toString(36)}${randomInt(1000, 9999)}`;
  const POST = (p, token, body) => call(baseUrl, 'POST', p, { token, body });
  const GET = (p, token) => call(baseUrl, 'GET', p, { token });

  async function register(gender) {
    const s = String(Date.now()).slice(-7) + randomInt(10, 99);
    const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
    const { rows: docs } = await db('select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true');
    const reg = await POST('/auth/register', undefined, {
      fullName: 'Interest Caller', email: `ic${s}@example.test`, password: 'Secret123', countryCode: '+91', mobileNumber,
      profileCreatedBy: 'myself', gender, language: 'en',
      consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
    });
    const ver = await POST('/auth/otp/verify', undefined, { countryCode: '+91', mobileNumber, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken });
    const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
    if (!token) throw new Error('no member token');
    return { token, userId: reg.body.userId };
  }
  async function approvedSender(gender = 'male') {
    const u = await register(gender);
    await db(`update "Users" set "profileReviewStatus"='approved',"accountStatus"='active' where id=$1`, [u.userId]);
    let r = await db(`select "profileUid" from "Profiles" where "userId"=$1`, [u.userId]);
    if (!r.rows[0]) {
      r = await db(`insert into "Profiles"("userId","profileUid") values($1,$2) returning "profileUid"`, [u.userId, `C${randomInt(100000000, 999999999)}${randomInt(10, 99)}`]);
    }
    const pid = (await db(`select id from "Profiles" where "userId"=$1`, [u.userId])).rows[0].id;
    await db(`insert into "ProfilePersonal"("profileId","dateOfBirth","heightCm") values($1,'1995-05-05',165) on conflict do nothing`, [pid]);
    await db(`update "ProfilePersonal" set "dateOfBirth"='1995-05-05' where "profileId"=$1`, [pid]);
    await db(`insert into "ProfileReligious"("profileId",religion,caste,subcaste) values($1,'Jain','Dhobi','Sub') on conflict do nothing`, [pid]);
    await db(`insert into "ProfileLocations"("profileId",country,state,city) values($1,'India','Gujarat',$2) on conflict do nothing`, [pid, TAG]);
    await db(`insert into "ProfileProfessional"("profileId",occupation,education) values($1,'Engineer','BSc') on conflict do nothing`, [pid]);
    await db(`insert into "ProfileFamilyBio"("profileId","aboutMyself","lookingFor","familyStatus") values($1,'a','b','middle') on conflict do nothing`, [pid]);
    return { ...u, profileUid: r.rows[0].profileUid };
  }
  async function seedReceiver(o = {}) {
    const id = randomUUID();
    const uid = `S${randomInt(100000000, 999999999)}${randomInt(10, 99)}`;
    await db(`insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus","profileReviewStatus",gender)
              values($1,'Seedy Person',$2,'x',$3,'user',$4,$5,$6)`,
      [id, `seed-${id}@example.test`, `8${String(randomInt(0, 999999999)).padStart(9, '0')}`, o.account ?? 'active', o.review ?? 'approved', o.gender ?? 'female']);
    const pr = await db(`insert into "Profiles"(id,"userId","profileUid","idVerified") values(gen_random_uuid(),$1,$2,false) returning id,"profileRef"`, [id, uid]);
    const pid = pr.rows[0].id;
    await db(`insert into "ProfilePersonal"("profileId","dateOfBirth","heightCm") values($1,'1995-05-05',165)`, [pid]);
    await db(`insert into "ProfileReligious"("profileId",religion,caste,subcaste) values($1,'Jain','Dhobi','Sub')`, [pid]);
    await db(`insert into "ProfileLocations"("profileId",country,state,city) values($1,'India','Gujarat',$2)`, [pid, TAG]);
    await db(`insert into "ProfileProfessional"("profileId",occupation,education) values($1,'Engineer','BSc')`, [pid]);
    await db(`insert into "ProfileFamilyBio"("profileId","aboutMyself","lookingFor","familyStatus") values($1,'a','b','middle')`, [pid]);
    return { userId: id, profileRef: pr.rows[0].profileRef, profileUid: uid };
  }
  // A receiver who can also act as a caller (needs a token): a registered, approved female.
  const approvedWithRef = async (gender) => {
    const u = await approvedSender(gender);
    const r = await db(`select id, "profileRef" from "Profiles" where "userId"=$1`, [u.userId]);
    const pid = r.rows[0].id;
    // Make the registered member visible in discovery (card rows), as seedReceiver does.
    await db(`insert into "ProfilePersonal"("profileId","dateOfBirth","heightCm") values($1,'1995-05-05',165) on conflict do nothing`, [pid]);
    await db(`update "ProfilePersonal" set "dateOfBirth"='1995-05-05' where "profileId"=$1`, [pid]);
    await db(`insert into "ProfileReligious"("profileId",religion,caste,subcaste) values($1,'Jain','Dhobi','Sub') on conflict do nothing`, [pid]);
    await db(`insert into "ProfileLocations"("profileId",country,state,city) values($1,'India','Gujarat',$2) on conflict do nothing`, [pid, TAG]);
    await db(`insert into "ProfileProfessional"("profileId",occupation,education) values($1,'Engineer','BSc') on conflict do nothing`, [pid]);
    await db(`insert into "ProfileFamilyBio"("profileId","aboutMyself","lookingFor","familyStatus") values($1,'a','b','middle') on conflict do nothing`, [pid]);
    return { ...u, profileRef: r.rows[0].profileRef };
  };
  const strip = (t) => t.replace(/"requestId":"[^"]*"/, '');
  const eventCount =async (id) => (await db(`select count(*)::int n from "InterestEvents" where "interestId"=$1`, [id])).rows[0].n;
  const rowCount = async (s, r) => (await db(`select count(*)::int n from "Interests" where "senderId"=$1 and "receiverId"=$2`, [s, r])).rows[0].n;

  // admin
  const adminEmail = `admin7${Date.now()}@example.test`;
  await db(`insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus") values($1,'E2E Admin',$2,$3,$4,'admin','active')`,
    [randomUUID(), adminEmail, await bcrypt.hash('AdminPass123!', 10), `7${String(Date.now()).slice(-9)}`]);
  const AT = (await POST('/admin/login', undefined, { email: adminEmail, password: 'AdminPass123!' })).body?.accessToken;

  const A = await approvedSender('male');
  const R1 = await approvedWithRef('female');

  // ---------------- AC1
  let firstId;
  await check('AC1-send-201', async () => {
    const r = await POST('/interests', A.token, { receiverProfileRef: R1.profileRef });
    firstId = r.body?.id;
    return [r.status === 201 && r.body?.status === 'pending' && !!r.body?.id, `POST /interests -> ${r.status} ${r.text.slice(0, 200)}`];
  });
  await check('AC1-errors', async () => {
    const self = await POST('/interests', A.token, { receiverProfileRef: A.profileRef ?? (await db(`select "profileRef" r from "Profiles" where "userId"=$1`, [A.userId])).rows[0].r });
    const hidden = await seedReceiver();
    await db(`insert into "HiddenProfiles"("userId","hiddenId") values($1,$2)`, [A.userId, hidden.userId]);
    const draft = await seedReceiver({ review: 'draft', account: 'pending' });
    const unknown = await POST('/interests', A.token, { receiverProfileRef: 'f'.repeat(32) });
    const malformed = await POST('/interests', A.token, { receiverProfileRef: 'nope' });
    const h = await POST('/interests', A.token, { receiverProfileRef: hidden.profileRef });
    const d = await POST('/interests', A.token, { receiverProfileRef: draft.profileRef });
    const noTok = await POST('/interests', undefined, { receiverProfileRef: R1.profileRef });
    const bad = await POST('/interests', 'garbage', { receiverProfileRef: R1.profileRef });
    const S = await register('male');
    await db(`update "Users" set "profileReviewStatus"='submitted',"accountStatus"='pending' where id=$1`, [S.userId]);
    const na = await POST('/interests', S.token, { receiverProfileRef: R1.profileRef });
    const missing = await POST('/interests', A.token, {});
    const same = [h, d, unknown].every((x) => x.status === 404 && x.body?.code === 'PROFILE_NOT_FOUND' && strip(x.text) === strip(h.text));
    return [self.status === 400 && self.body?.code === 'CANNOT_INTEREST_SELF' && same && malformed.status === 404
      && noTok.status === 401 && bad.status === 401 && na.status === 403 && na.body?.code === 'PROFILE_NOT_APPROVED' && missing.status === 400,
      `self ${self.status} ${self.body?.code}; hidden/draft/unknown ${h.status}/${d.status}/${unknown.status} identicalBody=${same}; malformed ${malformed.status}; noToken ${noTok.status}; garbage ${bad.status}; notApproved ${na.status} ${na.body?.code}; missing field ${missing.status}`];
  });

  // ---------------- AC2
  await check('AC2-partial-unique-index', async () => {
    const idx = (await db(`select indexdef from pg_indexes where tablename='Interests' and indexname='interests_active_pair_unique'`)).rows[0]?.indexdef ?? '';
    const ok1 = /UNIQUE/i.test(idx) && /senderId/.test(idx) && /receiverId/.test(idx) && /pending/.test(idx) && /accepted/.test(idx);
    let dupErr = '';
    try { await db(`insert into "Interests"("senderId","receiverId",status) values($1,$2,'pending')`, [A.userId, R1.userId]); } catch (e) { dupErr = e.code; }
    return [ok1 && dupErr === '23505', `indexdef=${idx}; raw duplicate insert sqlstate=${dupErr}`];
  });
  await check('AC2-repeat-409', async () => {
    const r = await POST('/interests', A.token, { receiverProfileRef: R1.profileRef });
    return [r.status === 409 && r.body?.code === 'INTEREST_ALREADY_EXISTS', `repeat -> ${r.status} ${r.body?.code}`];
  });
  await check('AC2-concurrent-race', async () => {
    const S = await approvedSender('male');
    const R = await seedReceiver();
    const rs = await Promise.all([1, 2, 3, 4].map(() => POST('/interests', S.token, { receiverProfileRef: R.profileRef })));
    const codes = rs.map((x) => x.status).sort();
    const n = await rowCount(S.userId, R.userId);
    return [codes.filter((c) => c === 201).length === 1 && codes.filter((c) => c === 409).length === 3 && n === 1 && rs.filter((x) => x.status === 409).every((x) => x.body?.code === 'INTEREST_ALREADY_EXISTS'),
      `4 parallel sends -> ${codes}; rows=${n}`];
  });
  await check('AC2-two-parallel', async () => {
    const S = await approvedSender('male');
    const R = await seedReceiver();
    const rs = await Promise.all([1, 2].map(() => POST('/interests', S.token, { receiverProfileRef: R.profileRef })));
    const codes = rs.map((x) => x.status).sort();
    return [JSON.stringify(codes) === '[201,409]' && (await rowCount(S.userId, R.userId)) === 1, `2 parallel -> ${codes}; rows=${await rowCount(S.userId, R.userId)}`];
  });

  // ---------------- AC3
  const cd = {};
  await check('AC3-cooldown-day29-30', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const sent = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const dec = await POST(`/interests/${sent.body.id}/decline`, R.token);
    cd.S = S; cd.R = R; cd.id = sent.body.id;
    const b0 = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const iso = !Number.isNaN(Date.parse(b0.body?.details?.retryAfter ?? ''));
    await db(`update "Interests" set "respondedAt"=now() - interval '29 days' where id=$1`, [sent.body.id]);
    const d29 = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    await db(`update "Interests" set "respondedAt"=now() - interval '30 days' - interval '1 minute' where id=$1`, [sent.body.id]);
    const d30 = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    return [dec.status === 200 && b0.status === 409 && b0.body?.code === 'INTEREST_COOLDOWN' && iso && d29.status === 409 && d29.body?.code === 'INTEREST_COOLDOWN' && d30.status === 201,
      `declined ${dec.status}; immediate ${b0.status} ${b0.body?.code} retryAfter=${b0.body?.details?.retryAfter}; day29 ${d29.status}; day30 ${d30.status}`];
  });
  await check('AC3-cooldown-is-per-receiver', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const R2 = await seedReceiver();
    const sent = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    await POST(`/interests/${sent.body.id}/decline`, R.token);
    const other = await POST('/interests', S.token, { receiverProfileRef: R2.profileRef });
    return [other.status === 201, `other receiver after decline -> ${other.status}`];
  });

  // ---------------- AC4
  await check('AC4-accept-ownership-idempotent-terminal', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const T3 = await approvedSender('female');
    const sent = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const id = sent.body.id;
    const asSender = await POST(`/interests/${id}/accept`, S.token);
    const asThird = await POST(`/interests/${id}/accept`, T3.token);
    const unknown = await POST(`/interests/${randomUUID()}/accept`, R.token);
    const malformed = await POST(`/interests/not-a-uuid/accept`, R.token);
    const a1 = await POST(`/interests/${id}/accept`, R.token);
    const a2 = await POST(`/interests/${id}/accept`, R.token);
    const ev = await eventCount(id);
    const opp = await POST(`/interests/${id}/decline`, R.token);
    const wd = await POST(`/interests/${id}/withdraw`, S.token);
    return [asSender.status === 404 && asSender.body?.code === 'INTEREST_NOT_FOUND' && asThird.status === 404 && unknown.status === 404 && malformed.status === 404
      && a1.status === 200 && a1.body.status === 'accepted' && !!a1.body.respondedAt && a2.status === 200 && JSON.stringify(a1.body) === JSON.stringify(a2.body) && ev === 2
      && opp.status === 409 && opp.body?.code === 'INVALID_STATUS_TRANSITION' && wd.status === 409,
      `sender ${asSender.status}, third ${asThird.status}, unknown ${unknown.status}, malformed ${malformed.status}; accept ${a1.status}/${a2.status} identical=${JSON.stringify(a1.body) === JSON.stringify(a2.body)} events=${ev}; decline-after-accept ${opp.status} ${opp.body?.code}; withdraw-after-accept ${wd.status}`];
  });
  await check('AC4-decline-ownership-idempotent', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const sent = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const id = sent.body.id;
    const asSender = await POST(`/interests/${id}/decline`, S.token);
    const d1 = await POST(`/interests/${id}/decline`, R.token);
    const d2 = await POST(`/interests/${id}/decline`, R.token);
    const ev = await eventCount(id);
    const opp = await POST(`/interests/${id}/accept`, R.token);
    const noTok = await POST(`/interests/${id}/accept`);
    return [asSender.status === 404 && d1.status === 200 && d1.body.status === 'declined' && d2.status === 200 && JSON.stringify(d1.body) === JSON.stringify(d2.body) && ev === 2
      && opp.status === 409 && opp.body?.code === 'INVALID_STATUS_TRANSITION' && noTok.status === 401,
      `sender-decline ${asSender.status}; decline ${d1.status}/${d2.status}; events=${ev}; accept-after-decline ${opp.status} ${opp.body?.code}; noToken ${noTok.status}`];
  });

  // ---------------- AC5
  await check('AC5-withdraw', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const sent = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const id = sent.body.id;
    const byRecv = await POST(`/interests/${id}/withdraw`, R.token);
    const w = await POST(`/interests/${id}/withdraw`, S.token);
    const w2 = await POST(`/interests/${id}/withdraw`, S.token);
    const again = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    // accepted / declined cannot be withdrawn
    const R2 = await approvedWithRef('female');
    const s2 = await POST('/interests', S.token, { receiverProfileRef: R2.profileRef });
    await POST(`/interests/${s2.body.id}/accept`, R2.token);
    const wa = await POST(`/interests/${s2.body.id}/withdraw`, S.token);
    const R3 = await approvedWithRef('female');
    const s3 = await POST('/interests', S.token, { receiverProfileRef: R3.profileRef });
    await POST(`/interests/${s3.body.id}/decline`, R3.token);
    const wd = await POST(`/interests/${s3.body.id}/withdraw`, S.token);
    const accWithdrawn = await POST(`/interests/${id}/accept`, R.token);
    return [byRecv.status === 404 && byRecv.body?.code === 'INTEREST_NOT_FOUND' && w.status === 200 && w.body.status === 'withdrawn' && again.status === 201
      && wa.status === 409 && wd.status === 409 && wa.body?.code === 'INVALID_STATUS_TRANSITION' && accWithdrawn.status === 409,
      `receiver-withdraw ${byRecv.status}; withdraw ${w.status} ${w.body?.status}; second withdraw ${w2.status} (assumption: 409); resend ${again.status}; from accepted ${wa.status}; from declined ${wd.status}; accept-after-withdraw ${accWithdrawn.status}`];
  });

  // ---------------- AC6
  await check('AC6-lists-filter-limits', async () => {
    const S = await approvedSender('male');
    const recvs = [];
    for (let i = 0; i < 22; i++) recvs.push(await seedReceiver());
    const ids = [];
    for (const r of recvs) ids.push((await POST('/interests', S.token, { receiverProfileRef: r.profileRef })).body.id);
    const def = await GET('/interests/sent', S.token);
    const l50 = await GET('/interests/sent?limit=50', S.token);
    const l51 = await GET('/interests/sent?limit=51', S.token);
    const l0 = await GET('/interests/sent?limit=0', S.token);
    const badStatus = await GET('/interests/sent?status=bogus', S.token);
    const expired = await GET('/interests/sent?status=expired', S.token);
    const pend = await GET('/interests/sent?status=pending&limit=50', S.token);
    const decl = await GET('/interests/sent?status=declined', S.token);
    const p1 = await GET('/interests/sent?limit=10', S.token);
    const p2 = await GET(`/interests/sent?limit=10&cursor=${encodeURIComponent(p1.body.nextCursor)}`, S.token);
    const p3 = await GET(`/interests/sent?limit=10&cursor=${encodeURIComponent(p2.body.nextCursor)}`, S.token);
    const walked = [...p1.body.items, ...p2.body.items, ...p3.body.items].map((i) => i.id);
    const expectedOrder = [...ids].reverse();
    const badCursor = await GET('/interests/sent?cursor=%21%21bad', S.token);
    const recvOwn = await GET('/interests/received', S.token);
    const keys = JSON.stringify(def.body.items[0]);
    const memberKeys = Object.keys(def.body.items[0].member);
    return [def.status === 200 && def.body.items.length === 20 && def.body.nextCursor && l50.body.items.length === 22 && l50.body.nextCursor === null
      && l51.status === 400 && l0.status === 400 && badStatus.status === 400 && expired.status === 400 && pend.body.items.length === 22 && decl.body.items.length === 0
      && p3.body.nextCursor === null && JSON.stringify(walked) === JSON.stringify(expectedOrder) && badCursor.status === 400 && recvOwn.body.items.length === 0
      && !/"mutual"/.test(keys) && !memberKeys.some((k) => FORBIDDEN_KEY.test(k)) && typeof def.body.items[0].canChat === 'boolean',
      `default ${def.body.items.length} next=${!!def.body.nextCursor}; limit50 ${l50.body.items.length}; 51->${l51.status}; 0->${l0.status}; status=bogus ${badStatus.status}; status=expired ${expired.status}; pending ${pend.body.items.length}; walk 10/10/2 newest-first=${JSON.stringify(walked) === JSON.stringify(expectedOrder)}; badCursor ${badCursor.status}; own received ${recvOwn.body.items.length}; memberKeys=${memberKeys}`];
  });
  await check('AC6-canChat-neutral-label-no-leak', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const R2 = await approvedWithRef('female');
    const s1 = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const s2 = await POST('/interests', S.token, { receiverProfileRef: R2.profileRef });
    // pending-pending pair: R sends to S too
    const Sref = (await db(`select "profileRef" r from "Profiles" where "userId"=$1`, [S.userId])).rows[0].r;
    const back = await POST('/interests', R.token, { receiverProfileRef: Sref });
    const sentP = await GET('/interests/sent', S.token);
    const recvP = await GET('/interests/received', S.token);
    const pp = [...sentP.body.items, ...recvP.body.items].every((i) => i.canChat === false && i.status === 'pending');
    await POST(`/interests/${s1.body.id}/accept`, R.token);
    await POST(`/interests/${s2.body.id}/decline`, R2.token);
    const sent = await GET('/interests/sent', S.token);
    const recvByR = await GET('/interests/received', R.token);
    const acc = sent.body.items.find((i) => i.id === s1.body.id);
    const dec = sent.body.items.find((i) => i.id === s2.body.id);
    const recAcc = recvByR.body.items.find((i) => i.id === s1.body.id);
    const recvR2 = await GET('/interests/received', R2.token);
    const recDec = recvR2.body.items.find((i) => i.id === s2.body.id);
    if (!acc || !dec || !recAcc || !recDec) throw new Error(`missing item: sent=${sent.status}/${sent.body?.items?.length} recvR=${recvByR.status}/${recvByR.body?.items?.length} recvR2=${recvR2.status}/${recvR2.body?.items?.length} accFound=${!!acc} decFound=${!!dec} recAcc=${!!recAcc} recDec=${!!recDec} back=${back.status}`);
    const decText = JSON.stringify(dec);
    const noReason = !/reason|note/i.test(decText);
    const wtok = await GET('/interests/sent?status=declined', S.token);
    const noMutual = ![sentP, recvP, sent, recvByR].some((r) => /"mutual"/.test(r.text));
    const noContact = ![sent, recvByR, recvP].some((r) => JSON.parse(r.text).items.some((i) => Object.keys(i.member).some((k) => FORBIDDEN_KEY.test(k))));
    return [back.status === 201 && pp && acc.canChat === true && recAcc.canChat === true && dec.canChat === false && dec.status === 'declined' && dec.statusLabel === 'Not accepted' && noReason
      && wtok.body.items.length === 1 && recDec.canChat === false && noMutual && noContact,
      `pending-pending canChat all false=${pp}; accepted sender/receiver canChat=${acc.canChat}/${recAcc.canChat}; declined sender view=${decText.slice(0, 160)}; noMutual=${noMutual}; noContact=${noContact}`];
  });
  await check('AC6-withdrawn-canChat-false-and-401', async () => {
    const S = await approvedSender('male');
    const R = await seedReceiver();
    const s = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    await POST(`/interests/${s.body.id}/withdraw`, S.token);
    const l = await GET('/interests/sent?status=withdrawn', S.token);
    const unauth = await GET('/interests/sent');
    return [l.body.items.length === 1 && l.body.items[0].canChat === false && unauth.status === 401, `withdrawn list ${l.body.items.length} canChat=${l.body.items[0]?.canChat}; no token ${unauth.status}`];
  });

  // ---------------- AC7
  await check('AC7-one-event-per-transition', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const R2 = await approvedWithRef('female');
    const s = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const afterSend = await eventCount(s.body.id);
    await POST(`/interests/${s.body.id}/accept`, R.token);
    const s2 = await POST('/interests', S.token, { receiverProfileRef: R2.profileRef });
    await POST(`/interests/${s2.body.id}/decline`, R2.token);
    const S3 = await approvedSender('male');
    const s3 = await POST('/interests', S3.token, { receiverProfileRef: R.profileRef });
    await POST(`/interests/${s3.body.id}/withdraw`, S3.token);
    const ev = async (id) => (await db(`select "actorId","fromStatus","toStatus","createdAt" from "InterestEvents" where "interestId"=$1 order by "createdAt","toStatus"`, [id])).rows;
    const e1 = await ev(s.body.id); const e2 = await ev(s2.body.id); const e3 = await ev(s3.body.id);
    const f = (e) => e.map((x) => `${x.fromStatus}>${x.toStatus}`).join(',');
    const actors = e1[0].actorId === S.userId && e1[1].actorId === R.userId && e2[1].actorId === R2.userId && e3[1].actorId === S3.userId;
    // failed attempts add no event
    await POST(`/interests/${s.body.id}/decline`, R.token);
    await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    return [afterSend === 1 && f(e1) === 'null>pending,pending>accepted' && f(e2) === 'null>pending,pending>declined' && f(e3) === 'null>pending,pending>withdrawn' && actors && (await eventCount(s.body.id)) === 2,
      `send events=${afterSend}; accept ${f(e1)}; decline ${f(e2)}; withdraw ${f(e3)}; actors ok=${actors}; after 409s events=${await eventCount(s.body.id)}`];
  });
  await check('AC7-body-allowlist', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const s = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const res = {};
    for (const k of ['status', 'senderId', 'respondedAt', 'canChat']) {
      res[`send-${k}`] = (await POST('/interests', S.token, { receiverProfileRef: R.profileRef, [k]: k === 'canChat' ? true : 'accepted' })).status;
      for (const act of ['accept', 'decline', 'withdraw']) res[`${act}-${k}`] = (await POST(`/interests/${s.body.id}/${act}`, act === 'withdraw' ? S.token : R.token, { [k]: k === 'canChat' ? true : 'accepted' })).status;
    }
    const st = (await db(`select status from "Interests" where id=$1`, [s.body.id])).rows[0].status;
    return [Object.values(res).every((x) => x === 400) && st === 'pending' && (await eventCount(s.body.id)) === 1, `statuses=${JSON.stringify(res)}; stored status=${st}; events=${await eventCount(s.body.id)}`];
  });

  // ---------------- AC8
  await check('AC8-100-sends-unlimited', async () => {
    const S = await approvedSender('male');
    const recvs = [];
    for (let i = 0; i < 100; i++) recvs.push(await seedReceiver());
    const codes = [];
    for (const r of recvs) codes.push((await POST('/interests', S.token, { receiverProfileRef: r.profileRef })).status);
    const n = codes.filter((c) => c === 201).length;
    return [n === 100, `100 sends -> 201 x${n}; others=${JSON.stringify(codes.filter((c) => c !== 201))}`];
  });

  // ---------------- AC9
  await check('AC9-admin-clear', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const s = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    await POST(`/interests/${s.body.id}/decline`, R.token);
    const blocked = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const body = { senderProfileUid: S.profileUid, receiverProfileRef: R.profileRef, reasonCode: 'goodwill', notes: 'appeal ok' };
    const audits = async () => (await db(`select count(*)::int n from "AdminAuditLog" where action='interestCooldownClear' and "targetId"=$1`, [S.userId])).rows[0].n;
    const c1 = await POST('/admin/interests/cooldown/clear', AT, body);
    const n1 = await audits();
    const row = (await db(`select "adminId","targetId","relatedId","reasonCode",notes from "AdminAuditLog" where action='interestCooldownClear' and "targetId"=$1`, [S.userId])).rows[0];
    const after = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const c2 = await POST('/admin/interests/cooldown/clear', AT, body);
    const n2 = await audits();
    return [blocked.status === 409 && c1.status === 200 && n1 === 1 && row.reasonCode === 'goodwill' && row.notes === 'appeal ok' && row.relatedId === R.userId && !!row.adminId && after.status === 201
      && c2.status === 404 && c2.body?.code === 'COOLDOWN_NOT_FOUND' && n2 === 1,
      `blocked ${blocked.status}; clear ${c1.status} ${c1.text}; audit rows ${n1}; audit=${JSON.stringify(row)}; resend ${after.status}; second clear ${c2.status} ${c2.body?.code}; rows ${n2}`];
  });
  await check('AC9-no-cooldown-cases', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const never = await POST('/admin/interests/cooldown/clear', AT, { senderProfileUid: S.profileUid, receiverProfileRef: R.profileRef, reasonCode: 'other' });
    const s = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    await POST(`/interests/${s.body.id}/decline`, R.token);
    await db(`update "Interests" set "respondedAt"=now() - interval '31 days' where id=$1`, [s.body.id]);
    const expired = await POST('/admin/interests/cooldown/clear', AT, { senderProfileUid: S.profileUid, receiverProfileRef: R.profileRef, reasonCode: 'other' });
    const n = (await db(`select count(*)::int n from "AdminAuditLog" where action='interestCooldownClear' and "targetId"=$1`, [S.userId])).rows[0].n;
    return [never.status === 404 && never.body?.code === 'COOLDOWN_NOT_FOUND' && expired.status === 404 && n === 0, `never declined ${never.status}; expired ${expired.status}; audit rows ${n}`];
  });
  await check('AC9-auth-matrix-validation-allowlist', async () => {
    const S = await approvedSender('male');
    const R = await approvedWithRef('female');
    const s = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    await POST(`/interests/${s.body.id}/decline`, R.token);
    const good = { senderProfileUid: S.profileUid, receiverProfileRef: R.profileRef, reasonCode: 'other' };
    const P = '/admin/interests/cooldown/clear';
    const r = {
      noTok: (await POST(P, undefined, good)).status,
      member: (await POST(P, S.token, good)).status,
      garbage: (await POST(P, 'garbage', good)).status,
      badReason: (await POST(P, AT, { ...good, reasonCode: 'nope' })).status,
      noReason: (await POST(P, AT, { senderProfileUid: good.senderProfileUid, receiverProfileRef: good.receiverProfileRef })).status,
      extra: (await POST(P, AT, { ...good, adminId: randomUUID() })).status,
      extraStatus: (await POST(P, AT, { ...good, status: 'pending' })).status,
      missingSender: (await POST(P, AT, { receiverProfileRef: good.receiverProfileRef, reasonCode: 'other' })).status,
      longNotes: (await POST(P, AT, { ...good, notes: 'x'.repeat(501) })).status,
    };
    const n = (await db(`select count(*)::int n from "AdminAuditLog" where action='interestCooldownClear' and "targetId"=$1`, [S.userId])).rows[0].n;
    const stillBlocked = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    return [r.noTok === 401 && (r.member === 401 || r.member === 403) && r.garbage === 401 && r.badReason === 400 && r.noReason === 400 && r.extra === 400 && r.extraStatus === 400 && r.missingSender === 400 && r.longNotes === 400 && n === 0 && stillBlocked.status === 409,
      `${JSON.stringify(r)}; audit rows after all rejects=${n}; still in cooldown ${stillBlocked.status}`];
  });

  // ---------------- AC10
  await check('AC10-openapi', async () => {
    const text = readFileSync(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8');
    const doc = yaml ? yaml.parse(text) : null;
    if (!doc) return [false, 'yaml parser not available'];
    const P = doc.paths;
    const need = [['/interests', 'post'], ['/interests/{id}/accept', 'post'], ['/interests/{id}/decline', 'post'], ['/interests/{id}/withdraw', 'post'], ['/interests/sent', 'get'], ['/interests/received', 'get'], ['/admin/interests/cooldown/clear', 'post']];
    const missing = need.filter(([p, m]) => !P[p]?.[m]).map(([p, m]) => `${m} ${p}`);
    const blob = JSON.stringify(doc);
    const codes = ['CANNOT_INTEREST_SELF', 'INTEREST_ALREADY_EXISTS', 'INTEREST_COOLDOWN', 'INTEREST_NOT_FOUND', 'COOLDOWN_NOT_FOUND', 'INVALID_STATUS_TRANSITION', 'PROFILE_NOT_FOUND'];
    const noCode = codes.filter((c) => !blob.includes(c));
    const schemas = Object.keys(doc.components?.schemas ?? {}).filter((k) => /interest|cooldown/i.test(k));
    return [missing.length === 0 && noCode.length === 0 && /canChat/.test(blob) && /withdrawn/.test(blob) && /nextCursor/.test(blob),
      `missing=${JSON.stringify(missing)}; codes absent=${JSON.stringify(noCode)}; schemas=${schemas}; canChat=${/canChat/.test(blob)}; withdrawn=${/withdrawn/.test(blob)}`];
  });
  await check('AC10-openapi-vs-live-fields', async () => {
    if (!yaml) return [false, 'yaml parser not available'];
    const doc = yaml.parse(readFileSync(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8'));
    const S = await approvedSender('male');
    const R = await seedReceiver();
    const s = await POST('/interests', S.token, { receiverProfileRef: R.profileRef });
    const list = await GET('/interests/sent', S.token);
    const schemas = doc.components.schemas;
    const itemName = Object.keys(schemas).find((k) => /^Interest.*(Item|ListItem)$/.test(k)) ?? Object.keys(schemas).find((k) => /interest/i.test(k) && schemas[k].properties?.member);
    const viewName = Object.keys(schemas).find((k) => /^Interest(View)?$/.test(k));
    const itemProps = Object.keys(schemas[itemName]?.properties ?? {}).concat(...(schemas[itemName]?.allOf ?? []).map((a) => Object.keys(schemas[a.$ref?.split('/').pop()]?.properties ?? a.properties ?? {})));
    const liveKeys = Object.keys(list.body.items[0]);
    const undocumented = liveKeys.filter((k) => !itemProps.includes(k));
    const respKeys = Object.keys(s.body);
    const viewProps = Object.keys(schemas[viewName]?.properties ?? {});
    const undocResp = respKeys.filter((k) => !viewProps.includes(k));
    return [undocumented.length === 0 && undocResp.length === 0, `item schema=${itemName} props=${itemProps}; live keys=${liveKeys}; undocumented=${undocumented}; send schema=${viewName} undocumented=${undocResp}`];
  });

  return out;
}
