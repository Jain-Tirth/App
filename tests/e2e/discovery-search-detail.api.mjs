/**
 * Phase 1 story 6 - approved-only discovery, search and profile detail,
 * over HTTP + real PostgreSQL (npm --prefix Backend run test:api).
 * Seeds go in through the database seam; every assertion is on a real response.
 * The shared test database already holds approved members from other suites, so
 * every seeded group carries a unique city/religion tag and queries narrow on it.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'Phase 1 story 6 - approved-only discovery, search, profile detail';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(HERE, '..', '..', 'Backend');
const req = createRequire(path.join(BACKEND_DIR, 'package.json'));

const CARD_KEYS = ['age', 'city', 'community', 'firstName', 'photoRef', 'profession', 'profileRef', 'religion', 'verified'];
const DETAIL_EXTRA = ['aboutMyself', 'country', 'diet', 'education', 'employmentType', 'familyStatus', 'heightCm', 'lookingFor', 'maritalStatus', 'spokenLanguages', 'state', 'subcommunity'];
const FORBIDDEN_KEY = /email|mobile|dateofbirth|userid|profileuid|idnumber|document|passwordhash|\bdob\b/i;

async function call(baseUrl, method, p, { token } = {}) {
  const r = await fetch(`${baseUrl}${p}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* raw */ }
  return { status: r.status, body: json, text };
}
async function post(baseUrl, p, body) {
  const r = await fetch(`${baseUrl}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}

async function registerMember(baseUrl, database, gender) {
  const s = String(Date.now()).slice(-7) + randomInt(10, 99);
  const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
  const { rows: docs } = await database.query('select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true');
  const reg = await post(baseUrl, '/auth/register', {
    fullName: 'Disc Caller', email: `dc${s}@example.test`, password: 'Secret123', countryCode: '+91', mobileNumber,
    profileCreatedBy: 'myself', gender, language: 'en',
    consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
  });
  const ver = await post(baseUrl, '/auth/otp/verify', { countryCode: '+91', mobileNumber, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken });
  const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
  if (!token) throw new Error('no member token');
  return { token, userId: reg.body.userId };
}

const card0 = (doc) => doc.components.schemas.DiscoveryCard;

export async function run({ baseUrl, database }) {
  const out = [];
  const db = (sql, p) => database.query(sql, p);
  const add = (ac, ok, evidence) => out.push({ ac, status: ok ? 'PASS' : 'FAIL', evidence: String(evidence).slice(0, 700) });
  const check = async (ac, fn) => {
    try { const [ok, ev] = await fn(); add(ac, ok, ev); } catch (e) { add(ac, false, `threw ${e.message}`); }
  };
  const TAG = `T${Date.now().toString(36)}${randomInt(1000, 9999)}`;

  async function seed(o = {}) {
    const id = randomUUID();
    const email = `seed-${id}@example.test`;
    const mobile = `8${String(randomInt(0, 999999999)).padStart(9, '0')}`;
    const uid = `S${randomInt(100000000, 999999999)}${randomInt(10, 99)}`;
    await db(`insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus","profileReviewStatus",gender)
              values($1,$2,$3,'x',$4,'user',$5,$6,$7)`,
      [id, o.name ?? 'Seedy Person', email, mobile, o.account ?? 'active', o.review ?? 'approved', o.gender ?? 'female']);
    const pr = await db(`insert into "Profiles"(id,"userId","profileUid","idVerified","createdAt") values(gen_random_uuid(),$1,$2,$3,coalesce($4::timestamptz, now())) returning id,"profileRef"`,
      [id, uid, o.verified ?? false, o.createdAt ?? null]);
    const pid = pr.rows[0].id;
    await db(`insert into "ProfilePersonal"("profileId","dateOfBirth","maritalStatus","eatingHabits","heightCm") values($1,$2,$3,$4,$5)`,
      [pid, o.dob ?? '1995-05-05', o.marital ?? null, o.diet ?? null, o.height ?? 165]);
    await db(`insert into "ProfileReligious"("profileId",religion,caste,subcaste) values($1,$2,$3,'Sub')`, [pid, o.religion ?? 'Jain', o.community ?? 'Dhobi']);
    await db(`insert into "ProfileLocations"("profileId",country,state,city) values($1,'India',$2,$3)`, [pid, o.state ?? 'Gujarat', o.city ?? TAG]);
    await db(`insert into "ProfileProfessional"("profileId",occupation,education) values($1,$2,'BSc')`, [pid, o.occupation ?? 'Engineer']);
    await db(`insert into "ProfileFamilyBio"("profileId","aboutMyself","lookingFor","familyStatus") values($1,'About me text','Looking text','middle')`, [pid]);
    const photos = [];
    for (const ph of o.photos ?? []) {
      const r = await db(`insert into "ProfilePhotos"("userId","fileUrl","isPrimary","validationStatus","photoKind","sortOrder") values($1,$2,$3,$4,$5,0) returning id`,
        [id, `https://fake.invalid/${randomUUID()}.jpg`, ph.primary ?? false, ph.validation ?? 'approved', ph.kind ?? 'individual']);
      photos.push({ ...ph, id: r.rows[0].id });
    }
    return { userId: id, profileRef: pr.rows[0].profileRef, profileUid: uid, email, mobile, photos };
  }
  const setStatus = (userId, review, account = 'active') => db(`update "Users" set "profileReviewStatus"=$2,"accountStatus"=$3 where id=$1`, [userId, review, account]);
  const approve = (userId) => setStatus(userId, 'approved', 'active');
  const refs = (res) => (res.body?.items ?? []).map((i) => i.profileRef);

  // ---------- callers
  const A = await registerMember(baseUrl, database, 'male');
  await approve(A.userId);
  const search = (q = '', tok = A.token) => call(baseUrl, 'GET', `/discovery/search${q ? `?${q}` : ''}`, { token: tok });
  const T = (q) => search(`city=${TAG}${q ? `&${q}` : ''}`);

  // ---------- AC1 hard filters
  const seeds = {};
  for (const st of ['draft', 'submitted', 'needsChanges', 'rejected']) seeds[st] = await seed({ review: st, account: st === 'rejected' ? 'rejected' : 'pending' });
  seeds.blocked = await seed({ review: 'approved', account: 'blocked' });
  seeds.hidden = await seed();
  seeds.under = await seed({ dob: '2015-01-01' });
  seeds.sameGender = await seed({ gender: 'male' });
  seeds.ok = await seed({ name: 'Okay Person', verified: true, occupation: 'Doctor' });
  await db(`insert into "HiddenProfiles"("userId","hiddenId") values($1,$2)`, [A.userId, seeds.hidden.userId]);
  const callerProfile = await db(`select count(*)::int n from "Profiles" where "userId"=$1`, [A.userId]);
  if (callerProfile.rows[0].n === 0) {
    await db(`insert into "Profiles"("userId","profileUid") values($1,$2)`, [A.userId, `C${randomInt(100000000, 999999999)}`]);
  }
  await check('AC1-per-status-seeds', async () => {
    const r = await T('');
    const got = refs(r);
    const bad = Object.entries(seeds).filter(([k]) => k !== 'ok' && got.includes(seeds[k].profileRef)).map(([k]) => k);
    return [r.status === 200 && got.includes(seeds.ok.profileRef) && bad.length === 0 && got.length === 1,
      `GET search?city=TAG -> ${r.status}; items=${got.length}; present bad seeds=${JSON.stringify(bad)}; approved opposite-gender seed present=${got.includes(seeds.ok.profileRef)}`];
  });
  await check('AC1-whole-index-walk', async () => {
    const all = []; let cursor = null; let pages = 0;
    do {
      const r = await search(`limit=50${cursor ? `&cursor=${cursor}` : ''}`);
      if (r.status !== 200) return [false, `page ${pages} -> ${r.status} ${r.text.slice(0, 200)}`];
      all.push(...refs(r)); cursor = r.body.nextCursor; pages += 1;
    } while (cursor && pages < 40);
    const badRefs = [seeds.draft, seeds.submitted, seeds.needsChanges, seeds.rejected, seeds.blocked, seeds.hidden, seeds.under, seeds.sameGender].map((s) => s.profileRef);
    const leaked = badRefs.filter((x) => all.includes(x)).length;
    const dup = all.length - new Set(all).size;
    const callerRef = (await db(`select "profileRef" r from "Profiles" where "userId"=$1`, [A.userId])).rows[0].r;
    return [leaked === 0 && dup === 0 && !all.includes(callerRef) && (cursor === null ? all.includes(seeds.ok.profileRef) : true),
      `unfiltered walk ${pages} pages, ${all.length} items, leaked=${leaked}, duplicates=${dup}, caller present=${all.includes(callerRef)}, endedOnNull=${cursor === null}`];
  });
  await check('AC1-under-age-female-caller-vs-men', async () => {
    const F = await registerMember(baseUrl, database, 'female');
    await approve(F.userId);
    const tag = `${TAG}m`;
    const m20 = await seed({ gender: 'male', dob: new Date(Date.now() - 20.5 * 365.25 * 864e5).toISOString().slice(0, 10), city: tag });
    const m25 = await seed({ gender: 'male', dob: '2000-01-01', city: tag });
    const r = await search(`city=${tag}`, F.token);
    const got = refs(r);
    return [got.includes(m25.profileRef) && !got.includes(m20.profileRef), `male aged ~20 (<21 gate) absent, 25 present: ${JSON.stringify(got.map((g) => g === m25.profileRef ? 'm25' : g === m20.profileRef ? 'm20' : '?'))}`];
  });
  await check('AC1-sql-not-client', async () => {
    const q = readFileSync(path.join(BACKEND_DIR, 'src/discovery/discovery-queries.ts'), 'utf8');
    const svc = readFileSync(path.join(BACKEND_DIR, 'src/discovery/discovery.service.ts'), 'utf8');
    const inSql = ['profileReviewStatus" = \'approved\'', 'HiddenProfiles', 'u."id" <> $1', 'dateOfBirth'].every((s) => q.includes(s));
    const noClientFilter = !/\.filter\(/.test(svc);
    return [inSql && noClientFilter, `VISIBLE_WHERE holds approved/hidden/self/age; service has no .filter( : ${noClientFilter}`];
  });

  // ---------- AC2 guard
  await check('AC2-403-all-endpoints-by-status', async () => {
    const rows = [];
    let ok = true;
    for (const st of ['draft', 'submitted', 'needsChanges', 'rejected']) {
      const U = await registerMember(baseUrl, database, 'male');
      await setStatus(U.userId, st, st === 'rejected' ? 'rejected' : 'pending');
      const rs = [await call(baseUrl, 'GET', '/discovery/recommendations', { token: U.token }),
        await search('', U.token),
        await call(baseUrl, 'GET', `/profiles/${seeds.ok.profileRef}`, { token: U.token })];
      const pass = rs.every((x) => x.status === 403 && x.body?.code === 'PROFILE_NOT_APPROVED' && x.body?.details?.status === st);
      ok = ok && pass; rows.push(`${st}:${rs.map((x) => x.status).join('/')}`);
    }
    return [ok, rows.join(' ')];
  });
  await check('AC2-401-no-token', async () => {
    const rs = [await call(baseUrl, 'GET', '/discovery/recommendations'), await call(baseUrl, 'GET', '/discovery/search'), await call(baseUrl, 'GET', `/profiles/${seeds.ok.profileRef}`)];
    const bad = await call(baseUrl, 'GET', '/discovery/search', { token: 'not-a-jwt' });
    return [rs.every((x) => x.status === 401) && bad.status === 401, `no token -> ${rs.map((x) => x.status)}; garbage token -> ${bad.status}`];
  });

  // ---------- AC3 pagination
  await check('AC3-default-20-and-limit-bounds', async () => {
    const tag = `${TAG}d`;
    for (let i = 0; i < 25; i++) await seed({ city: tag });
    const dflt = await search(`city=${tag}`);
    const l50 = await search(`city=${tag}&limit=50`);
    const l51 = await search(`city=${tag}&limit=51`);
    const l0 = await search(`city=${tag}&limit=0`);
    const lneg = await search(`city=${tag}&limit=-1`);
    const labc = await search(`city=${tag}&limit=abc`);
    const fieldErr = (r) => JSON.stringify(r.body).includes('limit');
    return [dflt.body.items.length === 20 && dflt.body.nextCursor !== null && l50.status === 200 && l50.body.items.length === 25 && l50.body.nextCursor === null
      && l51.status === 400 && l0.status === 400 && lneg.status === 400 && labc.status === 400 && fieldErr(l51) && fieldErr(l0),
      `default items=${dflt.body.items.length} next=${dflt.body.nextCursor ? 'set' : 'null'}; limit=50 -> ${l50.status} items=${l50.body.items.length} next=${l50.body.nextCursor}; 51 -> ${l51.status} ${JSON.stringify(l51.body?.details)}; 0 -> ${l0.status}; -1 -> ${lneg.status}; abc -> ${labc.status}`];
  });
  await check('AC3-stable-cursor-with-insert', async () => {
    const tag = `${TAG}p`;
    const base = Date.now() - 3600e3;
    const mine = [];
    for (let i = 0; i < 5; i++) mine.push(await seed({ city: tag, createdAt: new Date(base + i * 1000).toISOString() }));
    const expected = mine.map((s) => s.profileRef).reverse(); // newest first
    const p1 = await search(`city=${tag}&limit=2`);
    const inserted = await seed({ city: tag }); // newest of all, lands before page 1
    const p2 = await search(`city=${tag}&limit=2&cursor=${p1.body.nextCursor}`);
    const p3 = await search(`city=${tag}&limit=2&cursor=${p2.body.nextCursor}`);
    const seen = [...refs(p1), ...refs(p2), ...refs(p3)];
    const dup = seen.length - new Set(seen).size;
    return [JSON.stringify(seen) === JSON.stringify(expected) && dup === 0 && p3.body.nextCursor === null && !seen.includes(inserted.profileRef) && p1.body.nextCursor !== null,
      `pages ${refs(p1).length}/${refs(p2).length}/${refs(p3).length}; duplicates=${dup}; skipped=${expected.filter((x) => !seen.includes(x)).length}; last nextCursor=${p3.body.nextCursor}; response keys=${Object.keys(p1.body)}`];
  });
  await check('AC3-invalid-cursor', async () => {
    const good = (await T('limit=1')).body.nextCursor ?? (await search('limit=1')).body.nextCursor;
    const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
    const cases = {
      notBase64: 'not-base64!!',
      plainText: 'hello',
      jsonWrongShape: b64({ t: 'x', r: 'y' }),
      jsonArray: b64('[1,2]'),
      truncated: good.slice(0, good.length - 6),
      sqlInCursor: b64({ t: "2020-01-01T00:00:00.000000'); drop table \"Users\";--", r: 'a'.repeat(32) }),
    };
    const res = {};
    for (const [k, v] of Object.entries(cases)) { const r = await search(`cursor=${encodeURIComponent(v)}`); res[k] = `${r.status}:${r.body?.code}`; }
    const empty = await search('cursor=');
    return [Object.values(res).every((x) => x === '400:INVALID_CURSOR') && empty.status === 400, `${JSON.stringify(res)}; empty cursor -> ${empty.status} ${empty.body?.code}`];
  });
  await check('AC3-no-count-on-request-path', async () => {
    const q = readFileSync(path.join(BACKEND_DIR, 'src/discovery/discovery-queries.ts'), 'utf8');
    const repo = readFileSync(path.join(BACKEND_DIR, 'src/discovery/postgres-discovery.repository.ts'), 'utf8');
    const r = await search('limit=1');
    return [!/count\s*\(/i.test(q) && !/count\s*\(/i.test(repo) && !('total' in r.body), `COUNT( in discovery-queries.ts/repository: ${/count\s*\(/i.test(q + repo)}; search body keys=${Object.keys(r.body)}`];
  });

  // ---------- AC4 filters
  const fx = await seed({ religion: `Rel${TAG}`, community: `Com${TAG}`, state: `St${TAG}`, city: `${TAG}f`, diet: 'vegetarian', marital: 'divorced' });
  const fy = await seed({ religion: `Oth${TAG}`, community: `Oth${TAG}`, state: `Oth${TAG}`, city: `${TAG}f`, diet: 'nonVegetarian', marital: 'neverMarried' });
  const FQ = (q) => search(`city=${TAG}f&${q}`);
  for (const [label, qx, qy] of [
    ['religion', `religion=Rel${TAG}`, `religion=Oth${TAG}`],
    ['community', `community=Com${TAG}`, `community=Oth${TAG}`],
    ['state', `state=St${TAG}`, `state=Oth${TAG}`],
    ['diet', 'diet=vegetarian', 'diet=nonVegetarian'],
    ['maritalStatus', 'maritalStatus=divorced', 'maritalStatus=neverMarried'],
  ]) {
    await check(`AC4-filter-${label}`, async () => {
      const a = await FQ(qx); const b = await FQ(qy);
      return [JSON.stringify(refs(a)) === JSON.stringify([fx.profileRef]) && JSON.stringify(refs(b)) === JSON.stringify([fy.profileRef]), `${qx} -> ${a.status} ${refs(a).length} item(s) (=X:${refs(a)[0] === fx.profileRef}); ${qy} -> ${refs(b).length} item(s) (=Y:${refs(b)[0] === fy.profileRef})`];
    });
  }
  await check('AC4-filter-city', async () => {
    const both = await search(`city=${TAG}f`);
    const one = await search(`city=${TAG}`);
    const lower = await search(`city=${TAG.toLowerCase()}f`);
    return [refs(both).length === 2 && !refs(one).includes(fx.profileRef) && refs(lower).length === 2, `city=TAGf -> ${refs(both).length}; city=TAG excludes X: ${!refs(one).includes(fx.profileRef)}; lowercase city -> ${refs(lower).length} (case-insensitive)`];
  });
  await check('AC4-filter-non-approved-never-returned', async () => {
    const g = await seed({ review: 'submitted', account: 'pending', religion: `Rel${TAG}`, city: `${TAG}f` });
    const r = await FQ(`religion=Rel${TAG}`);
    return [!refs(r).includes(g.profileRef), `matching but submitted seed absent: ${!refs(r).includes(g.profileRef)}`];
  });
  await check('AC4-unknown-params-400', async () => {
    const qs = ['ageMin=20', 'ageMax=40', 'heightMin=150', 'heightMax=190', `profileUid=${seeds.ok.profileUid}`, 'sort=password', 'sort=createdAt', 'bogus=1', 'role=admin', 'maritalStatus=hacked', 'diet=pizza', 'order=asc'];
    const res = {};
    for (const q of qs) { const r = await search(q); res[q.replace(seeds.ok.profileUid, '<uid>')] = r.status; }
    const okSort = await search('sort=newest');
    return [Object.values(res).every((s) => s === 400) && okSort.status === 200, `${JSON.stringify(res)}; sort=newest -> ${okSort.status}`];
  });
  await check('AC4-sql-metacharacters', async () => {
    const payloads = ["' OR '1'='1", "'; DROP TABLE \"Users\"; --", "\" OR 1=1 --", "%", "_", "\\", "x') UNION SELECT 1--"];
    const res = [];
    for (const p of payloads) {
      for (const f of ['city', 'religion', 'community', 'state']) {
        const r = await search(`${f}=${encodeURIComponent(p)}`);
        res.push(`${r.status}/${(r.body?.items ?? []).length}`);
      }
    }
    const users = await db(`select count(*)::int n from "Users"`);
    return [res.every((x) => x === '200/0') && users.rows[0].n > 0, `${payloads.length * 4} requests -> all ${[...new Set(res)]}; Users table intact (${users.rows[0].n} rows)`];
  });

  // ---------- AC5 card shape, photo rule
  await check('AC5-card-key-audit', async () => {
    const r = await T('');
    const card = r.body.items[0];
    const keys = Object.keys(card).sort();
    return [JSON.stringify(keys) === JSON.stringify(CARD_KEYS) && !keys.some((k) => FORBIDDEN_KEY.test(k)) && card.firstName === 'Okay' && card.verified === true && Number.isInteger(card.age) && card.profession === 'Doctor' && card.city === TAG && card.religion === 'Jain' && card.community === 'Dhobi',
      `keys=${keys}; card=${JSON.stringify(card)}`];
  });
  await check('AC5-no-leak-values', async () => {
    const r = await T('');
    const d = await call(baseUrl, 'GET', `/profiles/${seeds.ok.profileRef}`, { token: A.token });
    const all = r.text + d.text;
    const leaks = [seeds.ok.email, seeds.ok.mobile, seeds.ok.profileUid, seeds.ok.userId, '1995-05-05'].filter((v) => all.includes(v));
    return [leaks.length === 0, `leaked values: ${JSON.stringify(leaks)}`];
  });
  await check('AC5-age-computed', async () => {
    const dob = new Date(); dob.setUTCFullYear(dob.getUTCFullYear() - 30); dob.setUTCDate(dob.getUTCDate() - 1);
    const s = await seed({ dob: dob.toISOString().slice(0, 10), city: `${TAG}a` });
    const r = await search(`city=${TAG}a`);
    return [r.body.items[0]?.age === 30, `dob ${dob.toISOString().slice(0, 10)} -> age ${r.body.items[0]?.age}; ref ${s.profileRef}`];
  });
  await check('AC5-photo-rule', async () => {
    const tag = `${TAG}ph`;
    const good = await seed({ city: tag, photos: [{ primary: true, kind: 'individual' }, { primary: false, kind: 'family' }] });
    const fam = await seed({ city: tag, photos: [{ primary: true, kind: 'family' }] });
    const grp = await seed({ city: tag, photos: [{ primary: true, kind: 'group' }] });
    const pre = await seed({ city: tag, photos: [{ primary: true, kind: 'preWedding' }] });
    const pend = await seed({ city: tag, photos: [{ primary: true, kind: 'individual', validation: 'pending' }] });
    const rej = await seed({ city: tag, photos: [{ primary: true, kind: 'individual', validation: 'rejected' }] });
    const notPrimary = await seed({ city: tag, photos: [{ primary: false, kind: 'individual' }] });
    const none = await seed({ city: tag });
    const r = await search(`city=${tag}`);
    const byRef = Object.fromEntries(r.body.items.map((i) => [i.profileRef, i.photoRef]));
    const familyIds = [fam, grp, pre].flatMap((s) => s.photos.map((p) => p.id)).concat(good.photos[1].id);
    const detailTexts = [];
    for (const s of [good, fam, grp, pre]) detailTexts.push((await call(baseUrl, 'GET', `/profiles/${s.profileRef}`, { token: A.token })).text);
    const leaked = familyIds.filter((id) => r.text.includes(id) || detailTexts.some((t) => t.includes(id)));
    const detailPhoto = JSON.parse(detailTexts[1]).photoRef;
    const ok = byRef[good.profileRef] === good.photos[0].id && [fam, grp, pre, pend, rej, notPrimary, none].every((s) => byRef[s.profileRef] === null) && leaked.length === 0 && detailPhoto === null;
    return [ok, `good->${byRef[good.profileRef] === good.photos[0].id ? 'primary individual id' : byRef[good.profileRef]}; family/group/preWedding/pending/rejected/non-primary/none -> ${[fam, grp, pre, pend, rej, notPrimary, none].map((s) => byRef[s.profileRef])}; non-individual ids leaked=${leaked.length}; family-only detail photoRef=${detailPhoto}`];
  });
  await check('AC5-db-allows-nonindividual-primary-note', async () => {
    const r = await db(`select pg_get_constraintdef(oid) d from pg_constraint where conrelid='"ProfilePhotos"'::regclass and conname like '%photo_kind%'`);
    return [true, `INFO: DB has only ${r.rows[0]?.d}; no CHECK stops a non-individual primary row (enforced in the query only, as the handoff states)`];
  });

  // ---------- AC6 detail
  await check('AC6-detail-200', async () => {
    const d = await call(baseUrl, 'GET', `/profiles/${seeds.ok.profileRef}`, { token: A.token });
    const keys = Object.keys(d.body ?? {}).sort();
    const want = [...CARD_KEYS, ...DETAIL_EXTRA].sort();
    return [d.status === 200 && JSON.stringify(keys) === JSON.stringify(want) && d.body.aboutMyself === 'About me text' && d.body.diet === null, `GET /profiles/<ref> -> ${d.status}; keys=${keys.join(',')}; missing=${want.filter((k) => !keys.includes(k))}; extra=${keys.filter((k) => !want.includes(k))}`];
  });
  await check('AC6-same-404-body', async () => {
    const B = await registerMember(baseUrl, database, 'male');
    await approve(B.userId);
    const Bp = (await db(`insert into "Profiles"("userId","profileUid") values($1,$2) returning "profileRef"`, [B.userId, `B${randomInt(100000000, 999999999)}`])).rows[0].profileRef;
    const blockedSelf = await registerMember(baseUrl, database, 'male');
    await approve(blockedSelf.userId);
    const BSref = (await db(`insert into "Profiles"("userId","profileUid") values($1,$2) returning "profileRef"`, [blockedSelf.userId, `X${randomInt(100000000, 999999999)}`])).rows[0].profileRef;
    await db(`update "Users" set "accountStatus"='blocked' where id=$1`, [blockedSelf.userId]);
    await db(`insert into "HiddenProfiles"("userId","hiddenId") values($1,$2)`, [B.userId, seeds.hidden.userId]);
    const targets = {
      unknownRef: 'a'.repeat(32), malformedRef: 'not-a-ref', draft: seeds.draft.profileRef, submitted: seeds.submitted.profileRef,
      rejected: seeds.rejected.profileRef, blockedTarget: seeds.blocked.profileRef, hidden: seeds.hidden.profileRef, underAge: seeds.under.profileRef, sameGender: seeds.sameGender.profileRef,
      selfRef: Bp,
    };
    const norm = (r) => JSON.stringify({ ...r.body, requestId: '-' });
    const results = {};
    for (const [k, v] of Object.entries(targets)) { const r = await call(baseUrl, 'GET', `/profiles/${v}`, { token: B.token }); results[k] = r; }
    const bs = await call(baseUrl, 'GET', `/profiles/${BSref}`, { token: blockedSelf.token });
    const bodies = new Set(Object.values(results).map(norm));
    const all404 = Object.values(results).every((r) => r.status === 404 && r.body?.code === 'PROFILE_NOT_FOUND');
    add('AC6-blocked-self-lookup', bs.status === 404 && norm(bs) === [...bodies][0], `blocked member (accountStatus=blocked, review=approved) looks up own ref -> ${bs.status} ${bs.text.slice(0, 160)}`);
    return [all404 && bodies.size === 1, `statuses=${JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.status])))}; distinct bodies (requestId ignored)=${bodies.size}: ${[...bodies][0]}`];
  });
  await check('AC6-profile-view-once-per-day', async () => {
    const V = await registerMember(baseUrl, database, 'male');
    await approve(V.userId);
    const tgt = await seed({ city: `${TAG}v` });
    const cnt = async () => (await db(`select count(*)::int n from "ProfileViews" where "viewerId"=$1 and "viewedId"=$2`, [V.userId, tgt.userId])).rows[0].n;
    const before = await cnt();
    const r1 = await call(baseUrl, 'GET', `/profiles/${tgt.profileRef}`, { token: V.token });
    const r2 = await call(baseUrl, 'GET', `/profiles/${tgt.profileRef}`, { token: V.token });
    const r3 = await call(baseUrl, 'GET', `/profiles/${tgt.profileRef}`, { token: V.token });
    const after = await cnt();
    await db(`update "ProfileViews" set "viewedOn"="viewedOn" - 1 where "viewerId"=$1 and "viewedId"=$2`, [V.userId, tgt.userId]);
    const r4 = await call(baseUrl, 'GET', `/profiles/${tgt.profileRef}`, { token: V.token });
    const nextDay = await cnt();
    const failed = await call(baseUrl, 'GET', `/profiles/${seeds.draft.profileRef}`, { token: V.token });
    const forDraft = (await db(`select count(*)::int n from "ProfileViews" where "viewerId"=$1 and "viewedId"=$2`, [V.userId, seeds.draft.userId])).rows[0].n;
    return [before === 0 && after === 1 && nextDay === 2 && [r1, r2, r3, r4].every((r) => r.status === 200) && forDraft === 0 && failed.status === 404,
      `rows before=${before}; after 3 reads=${after}; after moving row to yesterday + 1 read=${nextDay}; 404 read writes no row (${forDraft})`];
  });
  await check('AC6-route-order', async () => {
    const me = await call(baseUrl, 'GET', '/profiles/me', { token: A.token });
    const mt = await call(baseUrl, 'GET', '/profiles/matches', { token: A.token });
    return [me.status === 200 && mt.status === 200 && me.body?.code !== 'PROFILE_NOT_FOUND', `GET /profiles/me -> ${me.status}; /profiles/matches -> ${mt.status} (neither captured by :profileRef as a 404 PROFILE_NOT_FOUND: ${me.body?.code !== 'PROFILE_NOT_FOUND' && mt.body?.code !== 'PROFILE_NOT_FOUND'})`];
  });

  // ---------- AC7 no profileUid search, no rate limit
  await check('AC7-profileUid-400', async () => {
    const r = await search(`profileUid=${seeds.ok.profileUid}`);
    const r2 = await search(`profileUid=`);
    return [r.status === 400 && r2.status === 400 && !r.text.includes(seeds.ok.profileRef), `profileUid=<uid> -> ${r.status} ${r.body?.code}; empty -> ${r2.status}`];
  });
  await check('AC7-200-consecutive-searches', async () => {
    const t0 = Date.now(); const codes = [];
    for (let i = 0; i < 200; i++) codes.push((await T('')).status);
    const ms = Date.now() - t0;
    return [codes.every((c) => c === 200) && ms < 60000, `200 searches in ${ms} ms -> all 200: ${codes.every((c) => c === 200)}; non-200: ${codes.filter((c) => c !== 200)}`];
  });

  // ---------- AC8 recommendations
  const rec = (tok) => call(baseUrl, 'GET', '/discovery/recommendations', { token: tok });
  await check('AC8-max-9-stable-same-day', async () => {
    for (let i = 0; i < 12; i++) await seed({ city: `${TAG}r` });
    const C = await registerMember(baseUrl, database, 'male');
    await approve(C.userId);
    const r1 = await rec(C.token); const r2 = await rec(C.token);
    const a = refs(r1), b = refs(r2);
    const keysOk = r1.body.items.every((i) => JSON.stringify(Object.keys(i).sort()) === JSON.stringify(CARD_KEYS));
    return [r1.status === 200 && a.length === 9 && new Set(a).size === 9 && JSON.stringify(a) === JSON.stringify(b) && keysOk && Object.keys(r1.body).join() === 'items',
      `first=${a.length} distinct=${new Set(a).size}; second identical=${JSON.stringify(a) === JSON.stringify(b)}; card keys ok=${keysOk}; body keys=${Object.keys(r1.body)}`];
  });
  await check('AC8-hidden-excluded-before-and-after', async () => {
    const D = await registerMember(baseUrl, database, 'male');
    await approve(D.userId);
    // hide every approved woman except 3 fresh seeds, then hide one of the 3 after the set is fixed
    const keep = [await seed({ city: `${TAG}h` }), await seed({ city: `${TAG}h` }), await seed({ city: `${TAG}h` })];
    await db(`insert into "HiddenProfiles"("userId","hiddenId") select $1, id from "Users" where gender='female' and "profileReviewStatus"='approved' and id <> all($2::uuid[]) on conflict do nothing`, [D.userId, keep.map((k) => k.userId)]);
    const r1 = await rec(D.token);
    const got = new Set(refs(r1));
    await db(`insert into "HiddenProfiles"("userId","hiddenId") values($1,$2)`, [D.userId, keep[0].userId]);
    const r2 = await rec(D.token);
    return [r1.status === 200 && got.size === 3 && keep.every((k) => got.has(k.profileRef)) && !refs(r2).includes(keep[0].profileRef) && refs(r2).length === 2,
      `all other women hidden -> ${got.size} items (the 3 seeds); after hiding one -> ${refs(r2).length} items, hidden one absent=${!refs(r2).includes(keep[0].profileRef)}`];
  });
  await check('AC8-empty-for-new-member-no-candidate', async () => {
    const E = await registerMember(baseUrl, database, 'male');
    await approve(E.userId);
    await db(`insert into "HiddenProfiles"("userId","hiddenId") select $1, id from "Users" where gender='female' on conflict do nothing`, [E.userId]);
    const r = await rec(E.token);
    return [r.status === 200 && Array.isArray(r.body?.items) && r.body.items.length === 0, `-> ${r.status} ${r.text}`];
  });
  await check('AC8-hard-filters-in-recommendations', async () => {
    const G = await registerMember(baseUrl, database, 'male');
    await approve(G.userId);
    await db(`insert into "HiddenProfiles"("userId","hiddenId") select $1, id from "Users" where gender='female' on conflict do nothing`, [G.userId]);
    // unhide nothing: only the bad seeds below exist as non-hidden women
    const bad = [await seed({ review: 'draft', account: 'pending' }), await seed({ account: 'blocked' }), await seed({ dob: '2015-01-01' }), await seed({ review: 'rejected', account: 'rejected' })];
    const r = await rec(G.token);
    return [r.status === 200 && refs(r).length === 0 && !bad.some((b) => refs(r).includes(b.profileRef)), `only draft/blocked/under-age/rejected women unhidden -> ${refs(r).length} items`];
  });
  await check('AC8-env-default-configurable', async () => {
    const envSrc = readFileSync(path.join(BACKEND_DIR, 'src/config/env.ts'), 'utf8');
    return [/DAILY_RECOMMENDATIONS/.test(envSrc), `DAILY_RECOMMENDATIONS defined in src/config/env.ts: ${/DAILY_RECOMMENDATIONS/.test(envSrc)} (default 9 exercised above)`];
  });

  // ---------- legacy route shape
  await check('LEGACY-matches-new-shape', async () => {
    const r = await call(baseUrl, 'GET', '/profiles/matches', { token: A.token });
    const first = r.body?.matches?.[0];
    const keys = first ? Object.keys(first).sort() : [];
    return [r.status === 200 && Array.isArray(r.body?.matches) && JSON.stringify(keys) === JSON.stringify(CARD_KEYS) && !/profileUid|dateOfBirth|userId/.test(r.text), `GET /profiles/matches -> ${r.status}; total=${r.body?.total}; card keys=${keys}`];
  });

  // ---------- AC9 openapi
  await check('AC9-openapi-field-by-field', async () => {
    const yaml = req('js-yaml');
    const rawFile = readFileSync(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8');
    let parseError = null;
    try { yaml.load(rawFile); } catch (e) { parseError = String(e.message).split('\n')[0]; }
    add('AC9-openapi-parses-as-yaml', parseError === null, parseError ? `js-yaml cannot parse Backend/openapi.yaml: ${parseError}` : 'js-yaml parsed the whole file');
    // Neutralise only the unquoted-colon description so the discovery sections can still be checked.
    const raw = rawFile.replace(/^(\s+description: )Machine-readable error details.*$/m, '$1"sanitised by test"');
    const doc = yaml.load(raw);
    const miss = [];
    const need = (c, m) => { if (!c) miss.push(m); };
    const rp = doc.paths['/discovery/recommendations']?.get, sp = doc.paths['/discovery/search']?.get, dp = doc.paths['/profiles/{profileRef}']?.get;
    need(rp, 'recs path'); need(sp, 'search path'); need(dp, 'detail path');
    const params = Object.fromEntries((sp?.parameters ?? []).map((p) => [p.name, p]));
    for (const n of ['limit', 'cursor', 'sort', 'maritalStatus', 'religion', 'community', 'state', 'city', 'diet']) need(params[n], `param ${n}`);
    need(params.limit?.schema.minimum === 1 && params.limit?.schema.maximum === 50 && params.limit?.schema.default === 20, 'limit bounds 1..50 default 20');
    need(Object.keys(params).length === 9, `exactly 9 params, found ${Object.keys(params).length}`);
    const allParamNames = [rp, sp, dp].flatMap((o) => (o?.parameters ?? []).map((p) => p.name));
    need(!allParamNames.some((n) => /^(ageMin|ageMax|heightMin|heightMax|profileUid)$/.test(n)), 'no age/height/profileUid parameter on the 3 endpoints');
    need(!JSON.stringify([card0(doc), doc.components.schemas.ProfileDetail]).includes('profileUid'), 'no profileUid in card/detail schemas');
    need(!JSON.stringify([rp, sp, dp]).includes('RATE_LIMITED') && !JSON.stringify([rp, sp, dp]).includes('429'), 'no RATE_LIMITED/429 on the 3 endpoints');
    need(raw.includes('INVALID_CURSOR') && raw.includes('PROFILE_NOT_FOUND') && raw.includes('PROFILE_NOT_APPROVED'), 'error codes named');
    need(doc.components.responses.ProfileNotApproved, 'ProfileNotApproved response');
    for (const [label, op] of [['recs', rp], ['search', sp], ['detail', dp]]) need(op?.responses['401'] && op?.responses['403'], `${label} 401+403`);
    need(sp?.responses['400'] && dp?.responses['404'], 'search 400, detail 404');
    const card = doc.components.schemas.DiscoveryCard;
    need(JSON.stringify([...card.required].sort()) === JSON.stringify(CARD_KEYS), 'card required == live card keys');
    need(JSON.stringify(Object.keys(card.properties).sort()) === JSON.stringify(CARD_KEYS) && card.additionalProperties === false, 'card properties == live card keys, closed');
    const detail = doc.components.schemas.ProfileDetail;
    const extra = detail.allOf[1];
    need(JSON.stringify(Object.keys(extra.properties).sort()) === JSON.stringify(DETAIL_EXTRA), 'detail extra properties == live detail keys');
    need(JSON.stringify([...extra.required].sort()) === JSON.stringify(DETAIL_EXTRA), 'detail required == live');
    need(rp?.responses['200'].content['application/json'].schema.properties.items.maxItems === 9, 'recs maxItems 9');
    need(sp?.responses['200'].content['application/json'].schema.required.includes('nextCursor'), 'nextCursor required');
    need(doc.paths['/profiles/matches']?.get?.deprecated === true, 'matches deprecated');
    return [miss.length === 0, miss.length ? `missing: ${miss.join('; ')}` : 'js-yaml parsed; 3 paths, 9 search params with bounds, card/detail properties and required lists equal the live response keys, no age/height/profileUid/RATE_LIMITED, codes named'];
  });

  try {
    const dir = path.resolve(HERE, '..', '..', '.loop', 'artifacts');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'discovery-search-detail-results.json'), JSON.stringify(out, null, 2));
  } catch { /* artifact only */ }
  return out;
}
