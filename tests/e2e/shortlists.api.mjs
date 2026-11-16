/**
 * Phase 1 story 8 - named shortlists. HTTP + real PostgreSQL (npm --prefix Backend run test:api).
 */
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'Phase 1 story 8 - named shortlists';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(HERE, '..', '..', 'Backend');
const require = createRequire(path.join(BACKEND_DIR, 'package.json'));
const yaml = (() => { try { const y = require('js-yaml'); return { parse: (t) => y.load(t) }; } catch { return null; } })();

const FORBIDDEN_KEY = /email|mobile|dateofbirth|userid|profileuid|idnumber|document|passwordhash|\bdob\b|phone/i;

async function call(baseUrl, method, p, { token, body } = {}) {
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
  const TAG = `SL${Date.now().toString(36)}${randomInt(1000, 9999)}`;
  const POST = (p, token, body) => call(baseUrl, 'POST', p, { token, body });
  const GET = (p, token) => call(baseUrl, 'GET', p, { token });
  const PUT = (p, token, body) => call(baseUrl, 'PUT', p, { token, body });
  const PATCH = (p, token, body) => call(baseUrl, 'PATCH', p, { token, body });
  const DEL = (p, token) => call(baseUrl, 'DELETE', p, { token });
  const strip = (t) => t.replace(/"requestId":"[^"]*"/, '');

  async function register(gender) {
    const s = String(Date.now()).slice(-7) + randomInt(10, 99);
    const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
    const { rows: docs } = await db('select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true');
    const reg = await POST('/auth/register', undefined, {
      fullName: 'Shortlist Caller', email: `sl${s}@example.test`, password: 'Secret123', countryCode: '+91', mobileNumber,
      profileCreatedBy: 'myself', gender, language: 'en',
      consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
    });
    const ver = await POST('/auth/otp/verify', undefined, { countryCode: '+91', mobileNumber, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken });
    const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
    if (!token) throw new Error('no member token');
    return { token, userId: reg.body.userId };
  }
  async function approvedMember(gender = 'male') {
    const u = await register(gender);
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
    return { ...u, profileRef: r.rows[0].profileRef };
  }
  async function seedProfile(o = {}) {
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
    return { userId: id, profileRef: pr.rows[0].profileRef };
  }
  const membershipCount = async (listId) => (await db(`select count(*)::int n from "ShortlistProfiles" where "listId"=$1`, [listId])).rows[0].n;
  const mkList = async (token, nm) => (await POST('/shortlists', token, { name: nm })).body;

  const A = await approvedMember('male');
  const B = await approvedMember('male');
  const T1 = await seedProfile();
  const T2 = await seedProfile();

  // ---------------- AC1
  let def;
  await check('AC1-default-created-and-stable', async () => {
    const r1 = await GET('/shortlists', A.token);
    const r2 = await GET('/shortlists', A.token);
    def = r1.body?.[0];
    const rows = (await db(`select count(*)::int n from "ShortlistLists" where "userId"=$1`, [A.userId])).rows[0].n;
    return [r1.status === 200 && Array.isArray(r1.body) && r1.body.length === 1 && def.name === 'Shortlisted' && def.isDefault === true
      && r2.body?.[0]?.id === def.id && rows === 1 && def.profileCount === 0,
      `GET1 ${r1.status} ${r1.text.slice(0, 200)}; GET2 id same=${r2.body?.[0]?.id === def?.id}; db rows=${rows}`];
  });
  await check('AC1-default-protected', async () => {
    const d = await DEL(`/shortlists/${def.id}`, A.token);
    const p = await PATCH(`/shortlists/${def.id}`, A.token, { name: 'Renamed' });
    const still = (await GET('/shortlists', A.token)).body?.[0];
    return [d.status === 409 && d.body?.code === 'DEFAULT_SHORTLIST_PROTECTED' && p.status === 409 && p.body?.code === 'DEFAULT_SHORTLIST_PROTECTED' && still?.name === 'Shortlisted',
      `DELETE ${d.status} ${d.body?.code}; PATCH ${p.status} ${p.body?.code}; name still ${still?.name}`];
  });
  await check('AC1-concurrent-first-get', async () => {
    const C = await approvedMember('male');
    const rs = await Promise.all([1, 2, 3, 4].map(() => GET('/shortlists', C.token)));
    const n = (await db(`select count(*)::int n from "ShortlistLists" where "userId"=$1`, [C.userId])).rows[0].n;
    const ids = new Set(rs.map((r) => r.body?.[0]?.id));
    return [rs.every((r) => r.status === 200) && n === 1 && ids.size === 1, `4 parallel first GETs -> ${rs.map((r) => r.status)}; rows=${n}; distinct ids=${ids.size}; non-200 bodies: ${rs.filter((r) => r.status !== 200).map((r) => r.text.slice(0, 160)).join(' | ')}`];
  });

  // ---------------- AC2
  await check('AC2-name-boundaries', async () => {
    const empty = await POST('/shortlists', A.token, { name: '' });
    const ws = await POST('/shortlists', A.token, { name: '   ' });
    const missing = await POST('/shortlists', A.token, {});
    const one = await POST('/shortlists', A.token, { name: 'x' });
    const h = await POST('/shortlists', A.token, { name: 'h'.repeat(100) });
    const over = await POST('/shortlists', A.token, { name: 'o'.repeat(101) });
    const padded = await POST('/shortlists', A.token, { name: `  ${'p'.repeat(100)}  ` });
    const fieldErr = (r) => r.status === 400 && r.body?.code === 'VALIDATION_ERROR' && (r.body?.details?.issues ?? []).some((i) => /^name /.test(i)); // global pipe convention: details.issues, no details.fields
    return [fieldErr(empty) && fieldErr(ws) && fieldErr(over) && fieldErr(missing) && one.status === 201 && h.status === 201 && padded.status === 201 && padded.body?.name === 'p'.repeat(100),
      `0 -> ${empty.status} ${empty.text.slice(0, 200)} ${JSON.stringify(empty.body?.details?.fields)}; ws -> ${ws.status} ${JSON.stringify(ws.body?.details?.fields)}; missing -> ${missing.status}; 1 -> ${one.status}; 100 -> ${h.status}; 101 -> ${over.status} ${JSON.stringify(over.body?.details?.fields)}; 100 padded -> ${padded.status} trimmedLen=${padded.body?.name?.length}`];
  });
  await check('AC2-duplicate-case-insensitive', async () => {
    const a = await POST('/shortlists', A.token, { name: 'Family Pick' });
    const b = await POST('/shortlists', A.token, { name: 'fAMILY pICK' });
    const c = await POST('/shortlists', A.token, { name: '  Family Pick ' });
    const defDup = await POST('/shortlists', A.token, { name: 'shortlisted' });
    const other = await POST('/shortlists', B.token, { name: 'Family Pick' });
    const ren = await PATCH(`/shortlists/${a.body?.id}`, A.token, { name: 'x' });
    return [a.status === 201 && b.status === 409 && b.body?.code === 'SHORTLIST_NAME_TAKEN' && c.status === 409 && defDup.status === 409 && defDup.body?.code === 'SHORTLIST_NAME_TAKEN'
      && other.status === 201 && ren.status === 409 && ren.body?.code === 'SHORTLIST_NAME_TAKEN',
      `first ${a.status}; case-variant ${b.status} ${b.body?.code}; padded dup ${c.status}; vs default ${defDup.status}; other member ${other.status}; rename-to-taken ${ren.status} ${ren.body?.code}`];
  });
  await check('AC2-rename-ok', async () => {
    const l = await mkList(A.token, 'ToRename');
    const r = await PATCH(`/shortlists/${l.id}`, A.token, { name: 'Renamed OK' });
    const same = await PATCH(`/shortlists/${l.id}`, A.token, { name: 'renamed ok' });
    const bad = await PATCH(`/shortlists/${l.id}`, A.token, { name: '' });
    return [r.status === 200 && r.body?.name === 'Renamed OK' && r.body?.id === l.id && bad.status === 400,
      `rename -> ${r.status} ${r.text.slice(0, 160)}; rename to case-variant of itself -> ${same.status} ${same.body?.code ?? ''}; empty -> ${bad.status}`];
  });
  await check('AC2-25-lists', async () => {
    const C = await approvedMember('male');
    const codes = [];
    for (let i = 0; i < 25; i++) codes.push((await POST('/shortlists', C.token, { name: `List ${i}` })).status);
    const all = await GET('/shortlists', C.token);
    return [codes.every((c) => c === 201) && all.body?.length === 26, `25 creates -> all 201=${codes.every((c) => c === 201)}; GET returns ${all.body?.length} (25 + default)`];
  });

  // ---------------- AC3
  let L1;
  await check('AC3-add-idempotent-multi-list', async () => {
    L1 = await mkList(A.token, 'Add Tests');
    const L2 = await mkList(A.token, 'Add Tests 2');
    const p1 = await PUT(`/shortlists/${L1.id}/profiles/${T1.profileRef}`, A.token);
    const p2 = await PUT(`/shortlists/${L1.id}/profiles/${T1.profileRef}`, A.token);
    const p3 = await PUT(`/shortlists/${L2.id}/profiles/${T1.profileRef}`, A.token);
    const n1 = await membershipCount(L1.id);
    const n2 = await membershipCount(L2.id);
    return [p1.status === 200 && p2.status === 200 && p3.status === 200 && n1 === 1 && n2 === 1,
      `PUT ${p1.status} ${p1.text}; repeat ${p2.status}; other list ${p3.status}; rows L1=${n1} L2=${n2}`];
  });
  await check('AC3-not-found-identical', async () => {
    const hidden = await seedProfile();
    await db(`insert into "HiddenProfiles"("userId","hiddenId") values($1,$2)`, [A.userId, hidden.userId]);
    const draft = await seedProfile({ review: 'draft', account: 'pending' });
    const rejected = await seedProfile({ review: 'rejected' });
    const u = (p) => PUT(`/shortlists/${L1.id}/profiles/${p}`, A.token);
    const rs = [await u('f'.repeat(32)), await u(hidden.profileRef), await u(draft.profileRef), await u(rejected.profileRef)];
    const malformed = await u('nope');
    const same = rs.every((x) => x.status === 404 && x.body?.code === 'PROFILE_NOT_FOUND' && strip(x.text) === strip(rs[0].text));
    const rows = await membershipCount(L1.id);
    return [same && malformed.status === 404 && malformed.body?.code === 'PROFILE_NOT_FOUND' && rows === 1,
      `unknown/hidden/draft/rejected -> ${rs.map((x) => x.status)}; identical bodies=${same}; malformed ${malformed.status} ${malformed.body?.code}; L1 rows still ${rows}`];
  });
  await check('AC3-self-400', async () => {
    const r = await PUT(`/shortlists/${L1.id}/profiles/${A.profileRef}`, A.token);
    return [r.status === 400, `PUT self -> ${r.status} ${r.text.slice(0, 200)}`];
  });

  // ---------------- AC4
  await check('AC4-250-distinct-adds', async () => {
    const C = await approvedMember('male');
    const lists = [(await GET('/shortlists', C.token)).body[0], await mkList(C.token, 'Second')];
    const codes = [];
    for (let i = 0; i < 250; i++) {
      const t = await seedProfile();
      codes.push((await PUT(`/shortlists/${lists[i % 2].id}/profiles/${t.profileRef}`, C.token)).status);
    }
    const distinct = (await db(`select count(distinct sp."targetId")::int n from "ShortlistProfiles" sp join "ShortlistLists" l on l.id=sp."listId" where l."userId"=$1`, [C.userId])).rows[0].n;
    return [codes.every((c) => c === 200) && distinct === 250, `250 PUTs -> all 200=${codes.every((c) => c === 200)}; distinct stored=${distinct}`];
  });
  await check('AC4-no-limit-reached-code', async () => {
    const src = ['shortlist-limits.service.ts', 'shortlist.errors.ts', 'shortlists.service.ts'].map((f) => readFileSync(path.resolve(BACKEND_DIR, 'src/shortlists', f), 'utf8')).join('\n');
    return [!/SHORTLIST_LIMIT_REACHED/.test(src) && /SHORTLIST_LIMIT_EXCEEDED/.test(src), 'shortlist sources mention SHORTLIST_LIMIT_EXCEEDED only, never SHORTLIST_LIMIT_REACHED (unit test in jest covers the configured behaviour)'];
  });

  // ---------------- AC5
  await check('AC5-delete-membership-idempotent', async () => {
    const l = await mkList(A.token, 'Del Membership');
    await PUT(`/shortlists/${l.id}/profiles/${T2.profileRef}`, A.token);
    const d1 = await DEL(`/shortlists/${l.id}/profiles/${T2.profileRef}`, A.token);
    const d2 = await DEL(`/shortlists/${l.id}/profiles/${T2.profileRef}`, A.token);
    const unknown = await DEL(`/shortlists/${l.id}/profiles/${'e'.repeat(32)}`, A.token);
    const malformed = await DEL(`/shortlists/${l.id}/profiles/nope`, A.token);
    const n = await membershipCount(l.id);
    return [d1.status === 204 && d2.status === 204 && n === 0 && d1.text === '', `DELETE ${d1.status}, repeat ${d2.status}, unknown ref ${unknown.status}, malformed ref ${malformed.status}; rows=${n}`];
  });
  await check('AC5-delete-list-keeps-others', async () => {
    const la = await mkList(A.token, 'Keep Me');
    const lb = await mkList(A.token, 'Drop Me');
    await PUT(`/shortlists/${la.id}/profiles/${T2.profileRef}`, A.token);
    await PUT(`/shortlists/${lb.id}/profiles/${T2.profileRef}`, A.token);
    const d = await DEL(`/shortlists/${lb.id}`, A.token);
    const gone = await GET(`/shortlists/${lb.id}/profiles`, A.token);
    const keep = await GET(`/shortlists/${la.id}/profiles`, A.token);
    const lists = (await GET('/shortlists', A.token)).body;
    const memLeft = (await db(`select count(*)::int n from "ShortlistProfiles" where "listId"=$1`, [lb.id])).rows[0].n;
    const userStill = (await db(`select count(*)::int n from "Users" where id=$1`, [T2.userId])).rows[0].n;
    const d2 = await DEL(`/shortlists/${lb.id}`, A.token);
    return [d.status === 204 && gone.status === 404 && gone.body?.code === 'SHORTLIST_NOT_FOUND' && keep.body?.items?.length === 1 && memLeft === 0 && userStill === 1 && !lists.some((l) => l.id === lb.id) && d2.status === 404,
      `DELETE list ${d.status}; GET deleted ${gone.status} ${gone.body?.code}; other list items=${keep.body?.items?.length}; orphans=${memLeft}; target user rows=${userStill}; repeat delete ${d2.status}`];
  });

  // ---------------- AC6
  await check('AC6-ownership-404-all-routes', async () => {
    const mine = await mkList(B.token, 'B private');
    await PUT(`/shortlists/${mine.id}/profiles/${T1.profileRef}`, B.token);
    const lid = mine.id;
    const rs = {
      patch: await PATCH(`/shortlists/${lid}`, A.token, { name: 'steal' }),
      del: await DEL(`/shortlists/${lid}`, A.token),
      get: await GET(`/shortlists/${lid}/profiles`, A.token),
      put: await PUT(`/shortlists/${lid}/profiles/${T2.profileRef}`, A.token),
      delp: await DEL(`/shortlists/${lid}/profiles/${T1.profileRef}`, A.token),
    };
    const unknownId = await GET(`/shortlists/${randomUUID()}/profiles`, A.token);
    const malformedId = await GET(`/shortlists/not-a-uuid/profiles`, A.token);
    const intact = (await db(`select count(*)::int n from "ShortlistProfiles" where "listId"=$1`, [lid])).rows[0].n;
    const nameIntact = (await db(`select name from "ShortlistLists" where id=$1`, [lid])).rows[0]?.name;
    const all = Object.values(rs).every((r) => r.status === 404 && r.body?.code === 'SHORTLIST_NOT_FOUND' && strip(r.text) === strip(rs.patch.text));
    return [all && strip(unknownId.text) === strip(rs.patch.text) && malformedId.status === 404 && intact === 1 && nameIntact === 'B private',
      `statuses ${Object.entries(rs).map(([k, r]) => `${k}=${r.status}/${r.body?.code}`).join(' ')}; identical to unknown id=${strip(unknownId.text) === strip(rs.patch.text)}; malformed id ${malformedId.status}; B list intact rows=${intact} name=${nameIntact}`];
  });
  await check('AC6-401-403', async () => {
    const sub = await register('male');
    await db(`update "Users" set "profileReviewStatus"='submitted',"accountStatus"='pending' where id=$1`, [sub.userId]);
    const routes = [['GET', '/shortlists'], ['POST', '/shortlists', { name: 'x' }], ['PATCH', `/shortlists/${def.id}`, { name: 'x' }], ['DELETE', `/shortlists/${def.id}`],
      ['GET', `/shortlists/${def.id}/profiles`], ['PUT', `/shortlists/${def.id}/profiles/${T1.profileRef}`], ['DELETE', `/shortlists/${def.id}/profiles/${T1.profileRef}`]];
    const noTok = [], bad = [], na = [];
    for (const [m, p, b] of routes) {
      noTok.push((await call(baseUrl, m, p, { body: b })).status);
      bad.push((await call(baseUrl, m, p, { token: 'garbage', body: b })).status);
      const r = await call(baseUrl, m, p, { token: sub.token, body: b });
      na.push(`${r.status}/${r.body?.code}`);
    }
    return [noTok.every((s) => s === 401) && bad.every((s) => s === 401) && na.every((s) => s === '403/PROFILE_NOT_APPROVED'),
      `no token ${noTok}; garbage token ${bad}; submitted member ${na}`];
  });
  await check('AC6-body-allowlist', async () => {
    const u = await POST('/shortlists', A.token, { name: 'AL1', userId: B.userId });
    const d = await POST('/shortlists', A.token, { name: 'AL2', isDefault: true });
    const p = await PATCH(`/shortlists/${L1.id}`, A.token, { name: 'AL3', isDefault: true });
    const e = await PUT(`/shortlists/${L1.id}/profiles/${T2.profileRef}`, A.token, { userId: B.userId });
    const made = (await db(`select count(*)::int n from "ShortlistLists" where name in ('AL1','AL2','AL3')`)).rows[0].n;
    return [u.status === 400 && d.status === 400 && p.status === 400 && e.status === 400 && made === 0,
      `userId ${u.status} ${JSON.stringify(u.body?.details?.issues)}; isDefault ${d.status}; PATCH isDefault ${p.status}; PUT body ${e.status}; rows created ${made}`];
  });

  // ---------------- AC7
  let BIG; const bigRefs = [];
  await check('AC7-cards-default-20-max-50-cursor-walk', async () => {
    BIG = await mkList(A.token, 'Big');
    for (let i = 0; i < 55; i++) {
      const t = await seedProfile();
      bigRefs.push(t);
      await PUT(`/shortlists/${BIG.id}/profiles/${t.profileRef}`, A.token);
    }
    const first = await GET(`/shortlists/${BIG.id}/profiles`, A.token);
    const over = await GET(`/shortlists/${BIG.id}/profiles?limit=51`, A.token);
    const zero = await GET(`/shortlists/${BIG.id}/profiles?limit=0`, A.token);
    const fifty = await GET(`/shortlists/${BIG.id}/profiles?limit=50`, A.token);
    const seen = []; let cursor = null; let pages = 0;
    do {
      const r = await GET(`/shortlists/${BIG.id}/profiles?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, A.token);
      seen.push(...(r.body?.items ?? []).map((c) => c.profileRef));
      cursor = r.body?.nextCursor; pages++;
    } while (cursor && pages < 10);
    const unique = new Set(seen).size;
    const keys = JSON.stringify(first.body?.items?.[0] ?? {});
    const leak = Object.keys(first.body?.items?.[0] ?? {}).filter((k) => FORBIDDEN_KEY.test(k));
    return [first.status === 200 && first.body.items.length === 20 && !!first.body.nextCursor && over.status === 400 && zero.status === 400
      && fifty.body?.items?.length === 50 && seen.length === 55 && unique === 55 && pages === 3 && leak.length === 0,
      `default page ${first.body?.items?.length}; limit=51 -> ${over.status}; limit=0 -> ${zero.status}; limit=50 -> ${fifty.body?.items?.length}; walk of 20s: ${pages} pages, ${seen.length} items, ${unique} unique; forbidden keys ${JSON.stringify(leak)}; card keys ${keys.slice(0, 200)}`];
  });
  await check('AC7-invalid-cursor', async () => {
    const r = await GET(`/shortlists/${BIG.id}/profiles?cursor=garbage`, A.token);
    return [r.status === 400, `cursor=garbage -> ${r.status} ${r.text.slice(0, 160)}`];
  });
  await check('AC7-hidden-or-unapproved-omitted-row-kept', async () => {
    const L = await mkList(A.token, 'Visibility');
    const keep = await seedProfile(); const rej = await seedProfile(); const hid = await seedProfile();
    for (const t of [keep, rej, hid]) await PUT(`/shortlists/${L.id}/profiles/${t.profileRef}`, A.token);
    await db(`update "Users" set "profileReviewStatus"='rejected' where id=$1`, [rej.userId]);
    await db(`insert into "HiddenProfiles"("userId","hiddenId") values($1,$2)`, [A.userId, hid.userId]);
    const r = await GET(`/shortlists/${L.id}/profiles`, A.token);
    const refs = (r.body?.items ?? []).map((c) => c.profileRef);
    const rows = await membershipCount(L.id);
    const count = (await GET('/shortlists', A.token)).body.find((l) => l.id === L.id)?.profileCount;
    // restore: membership still there so profile reappears
    await db(`update "Users" set "profileReviewStatus"='approved' where id=$1`, [rej.userId]);
    const back = await GET(`/shortlists/${L.id}/profiles`, A.token);
    const del = await DEL(`/shortlists/${L.id}/profiles/${hid.profileRef}`, A.token);
    return [r.status === 200 && refs.length === 1 && refs[0] === keep.profileRef && rows === 3 && back.body?.items?.length === 2 && del.status === 204 && (await membershipCount(L.id)) === 2,
      `visible items=${refs.length}; membership rows=${rows}; profileCount in list view=${count} (raw, includes hidden); after re-approve items=${back.body?.items?.length}; DELETE hidden profile -> ${del.status}`];
  });

  // ---------------- AC8
  await check('AC8-schema', async () => {
    const t = (await db(`select table_name from information_schema.tables where table_name in ('ShortlistLists','ShortlistProfiles','Shortlists') order by 1`)).rows.map((r) => r.table_name);
    const mig = (await db(`select name from pgmigrations where name like '%named-shortlists%'`)).rows.map((r) => r.name);
    return [t.join() === 'ShortlistLists,ShortlistProfiles' && mig.length === 1, `tables ${t}; applied migrations ${mig} (data move/down proven by shortlists.migration.itest.ts under test:int)`];
  });

  // ---------------- AC9
  await check('AC9-openapi', async () => {
    const text = readFileSync(path.resolve(BACKEND_DIR, 'openapi.yaml'), 'utf8');
    if (!yaml) return [false, 'js-yaml unavailable'];
    const doc = yaml.parse(text);
    const P = doc.paths ?? {};
    const want = [['/shortlists', 'get'], ['/shortlists', 'post'], ['/shortlists/{id}', 'patch'], ['/shortlists/{id}', 'delete'],
      ['/shortlists/{id}/profiles', 'get'], ['/shortlists/{id}/profiles/{profileRef}', 'put'], ['/shortlists/{id}/profiles/{profileRef}', 'delete']];
    const missing = want.filter(([p, m]) => !P[p]?.[m]).map((x) => x.join(' '));
    const slice = want.map(([p, m]) => JSON.stringify(P[p]?.[m] ?? {})).join('\n');
    const codes = ['DEFAULT_SHORTLIST_PROTECTED', 'SHORTLIST_NAME_TAKEN', 'SHORTLIST_NOT_FOUND', 'PROFILE_NOT_FOUND'].filter((c) => !text.includes(c));
    const reached = /SHORTLIST_LIMIT_REACHED/.test(text);
    const exceededIdx = text.indexOf('SHORTLIST_LIMIT_EXCEEDED');
    const exceededCtx = exceededIdx >= 0 ? text.slice(Math.max(0, exceededIdx - 400), exceededIdx + 500) : '';
    const cfg = /configur/i.test(exceededCtx);
    const statuses = want.map(([p, m]) => `${m} ${p}: ${Object.keys(P[p][m]?.responses ?? {}).join('/')}`);
    return [missing.length === 0 && codes.length === 0 && !reached && cfg && slice.length > 0,
      `missing ops [${missing}]; missing codes [${codes}]; LIMIT_REACHED present=${reached}; LIMIT_EXCEEDED present=${exceededIdx >= 0} configuration-dependent=${cfg}; responses: ${statuses.join(' | ')}`];
  });

  return out;
}
