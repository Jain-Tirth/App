/**
 * Phase 1 story 2 - age gate (AC1..AC5 at HTTP level, AC7 on the contract file).
 * The default backend (AGE_MIN_MALE unset) is the harness one; a second backend is
 * booted here with AGE_MIN_MALE=22, and boot-refusal negatives are run as child processes.
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'Phase 1 story 2 - age gate';

const BACKEND_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'Backend',
);
const row = (ac, ok, evidence) => ({ ac, status: ok ? 'PASS' : 'FAIL', evidence });

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
/** Birth date that makes the person exactly `years` old today (UTC), shifted by `dayOffset`. */
function dobFor(years, dayOffset = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()));
  // 29 Feb today cannot be shifted back to a non-leap year by Date; Date rolls to 1 Mar, matching the convention.
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return isoDate(d);
}

function boot(port, extraEnv, databaseUrl) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port), NODE_ENV: 'development', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (c) => (output += c));
  child.stderr.on('data', (c) => (output += c));
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  return { child, exited, out: () => output };
}

async function waitUp(url, b) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${url}/consents/current`);
      if (r.status === 401 || r.ok) return true;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function call(baseUrl, method, p, { token, body } = {}) {
  const r = await fetch(`${baseUrl}${p}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* raw */
  }
  return { status: r.status, body: json, text };
}

async function newMember(baseUrl, database, gender) {
  const s = String(Date.now()).slice(-7) + Math.floor(Math.random() * 90 + 10);
  const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
  const { rows: docs } = await database.query(
    'select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true',
  );
  const reg = await call(baseUrl, 'POST', '/auth/register', {
    body: {
      fullName: 'Age Gate User',
      email: `age${s}@example.test`,
      password: 'Secret123',
      countryCode: '+91',
      mobileNumber,
      profileCreatedBy: 'myself',
      gender,
      language: 'en',
      consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
    },
  });
  const ver = await call(baseUrl, 'POST', '/auth/otp/verify', {
    body: { countryCode: '+91', mobileNumber, otpCode: reg.body?.otpCode, otpToken: reg.body?.otpToken },
  });
  const token = ver.body?.accessToken ?? ver.body?.tokens?.accessToken;
  if (!token) throw new Error(`no token: ${reg.status} ${reg.text.slice(0, 200)} / ${ver.text.slice(0, 200)}`);
  return { token, userId: reg.body.userId };
}

async function storedDob(database, userId) {
  const { rows } = await database.query(
    `select to_char(pp."dateOfBirth", 'YYYY-MM-DD') as dob
       from "ProfilePersonal" pp join "Profiles" p on p.id = pp."profileId"
      where p."userId" = $1`,
    [userId],
  );
  return rows[0]?.dob ?? null;
}

export async function run({ baseUrl, databaseUrl, database }) {
  const out = [];
  const put = (m, body) => call(baseUrl, 'PUT', '/profiles/step-1', { token: m.token, body });

  // ---------------- AC1 male 21
  const man = await newMember(baseUrl, database, 'male');
  const ok21 = await put(man, { gender: 'male', dateOfBirth: dobFor(21) });
  const saved21 = await storedDob(database, man.userId);
  out.push(row('AC1a', ok21.status < 300 && saved21 === dobFor(21), `exactly 21 (${dobFor(21)}) -> ${ok21.status}, stored ${saved21}`));

  const man2 = await newMember(baseUrl, database, 'male');
  const short = await put(man2, { gender: 'male', dateOfBirth: dobFor(21, 1) });
  const stored2 = await storedDob(database, man2.userId);
  out.push(
    row(
      'AC1b',
      short.status === 400 && short.body?.code === 'AGE_BELOW_MINIMUM' && short.body?.details?.minimumAge === 21 && stored2 === null && !!short.body?.requestId,
      `21y-1d (${dobFor(21, 1)}) -> ${short.status} ${short.text.slice(0, 200)}; stored ${stored2}`,
    ),
  );

  // ---------------- AC2 female 18
  const wom = await newMember(baseUrl, database, 'female');
  const short18 = await put(wom, { gender: 'female', dateOfBirth: dobFor(18, 1) });
  const wStoredBefore = await storedDob(database, wom.userId);
  out.push(
    row(
      'AC2b',
      short18.status === 400 && short18.body?.code === 'AGE_BELOW_MINIMUM' && short18.body?.details?.minimumAge === 18 && wStoredBefore === null,
      `18y-1d -> ${short18.status} ${short18.text.slice(0, 160)}; stored ${wStoredBefore}`,
    ),
  );
  const ok18 = await put(wom, { gender: 'female', dateOfBirth: dobFor(18) });
  const w18 = await storedDob(database, wom.userId);
  out.push(row('AC2a', ok18.status < 300 && w18 === dobFor(18), `exactly 18 (${dobFor(18)}) -> ${ok18.status}, stored ${w18}`));

  // ---------------- AC3
  const m3 = await newMember(baseUrl, database, 'male');
  const tomorrow = isoDate(new Date(Date.now() + 86400000));
  const fut = await put(m3, { gender: 'male', dateOfBirth: tomorrow });
  out.push(row('AC3a', fut.status === 400 && fut.body?.code === 'INVALID_DATE_OF_BIRTH', `future ${tomorrow} -> ${fut.status} ${fut.text.slice(0, 160)}`));
  for (const bad of ['2000-13-45', '2001-02-29']) {
    const r = await put(m3, { gender: 'male', dateOfBirth: bad });
    const mentions = JSON.stringify(r.body).includes('dateOfBirth');
    const st = await storedDob(database, m3.userId);
    out.push(row(`AC3-${bad}`, r.status === 400 && mentions && st === null, `${bad} -> ${r.status} ${r.text.slice(0, 220)}; stored ${st}`));
  }

  // ---------------- AC5 under-age over a valid profile
  const prior = dobFor(30);
  await put(man2, { gender: 'male', dateOfBirth: prior });
  const over = await put(man2, { gender: 'male', dateOfBirth: dobFor(19) });
  const after = await storedDob(database, man2.userId);
  out.push(row('AC5', over.status === 400 && over.body?.code === 'AGE_BELOW_MINIMUM' && after === prior, `valid ${prior} then 19y -> ${over.status}; stored ${after}`));

  // ---------------- AC4 positive: AGE_MIN_MALE=22
  const port = 3102;
  const url22 = `http://127.0.0.1:${port}/api/v1`;
  const b22 = boot(port, { AGE_MIN_MALE: '22' }, databaseUrl);
  try {
    const up = await waitUp(url22, b22);
    if (!up) {
      out.push(row('AC4a', false, `AGE_MIN_MALE=22 backend did not start: ${b22.out().slice(-300)}`));
    } else {
      const m22 = await newMember(url22, database, 'male');
      const r = await call(url22, 'PUT', '/profiles/step-1', { token: m22.token, body: { gender: 'male', dateOfBirth: dobFor(21) } });
      out.push(row('AC4a', r.status === 400 && r.body?.code === 'AGE_BELOW_MINIMUM' && r.body?.details?.minimumAge === 22, `AGE_MIN_MALE=22, 21y man -> ${r.status} ${r.text.slice(0, 160)}`));
      const r22 = await call(url22, 'PUT', '/profiles/step-1', { token: m22.token, body: { gender: 'male', dateOfBirth: dobFor(22) } });
      out.push(row('AC4a2', r22.status < 300, `AGE_MIN_MALE=22, exactly 22 -> ${r22.status}`));
    }
  } finally {
    b22.child.kill();
    await b22.exited;
  }

  // ---------------- AC4 negative boots
  for (const [k, v] of [['AGE_MIN_MALE', 'abc'], ['AGE_MIN_MALE', '17'], ['AGE_MIN_FEMALE', '18.5'], ['AGE_MIN_FEMALE', '10']]) {
    const b = boot(3103, { [k]: v }, databaseUrl);
    const code = await Promise.race([b.exited, new Promise((r) => setTimeout(() => r('still-running'), 30000))]);
    if (code === 'still-running') b.child.kill();
    out.push(row(`AC4-${k}=${v}`, code !== 'still-running' && code !== 0 && b.out().includes(k), `exit ${code}; output names ${k}: ${b.out().includes(k)}`));
  }

  // ---------------- AC7
  const yaml = await readFile(path.join(BACKEND_DIR, 'openapi.yaml'), 'utf8');
  const seg = yaml.slice(yaml.indexOf('/profiles/step-1:'), yaml.indexOf('components:'));
  out.push(row('AC7', seg.includes('AGE_BELOW_MINIMUM') && seg.includes('INVALID_DATE_OF_BIRTH') && seg.includes('#/components/schemas/ErrorEnvelope'), 'openapi.yaml step-1 block names both codes and ErrorEnvelope'));

  return out;
}
