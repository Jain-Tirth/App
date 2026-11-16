// Repeatable capture of intermittent 500s. Usage: node tests/e2e/capture-intermittent-500.mjs [iterations]
// Boots Backend/dist/main.js (run `npm --prefix Backend run build` first) on the test DB, stores the app log
// in .loop/artifacts/capture-app.log and every non-2xx in .loop/artifacts/capture-failures.json
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { createWriteStream, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BACKEND = path.join(REPO, 'Backend');
const ART = path.join(REPO, '.loop', 'artifacts');
mkdirSync(ART, { recursive: true });
const require = createRequire(path.join(BACKEND, 'package.json'));
const pg = require('pg');
const ITER = Number(process.argv[2] ?? 30);
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const DB = 'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';

const logPath = path.join(ART, 'capture-app.log');
const logStream = createWriteStream(logPath);
let logText = '';
const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: BACKEND,
  env: { ...process.env, DATABASE_URL: DB, PORT: String(PORT), NODE_ENV: 'development', STORAGE_PROVIDER: 'fake', KYC_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
for (const s of [child.stdout, child.stderr]) s.on('data', (c) => { logText += c.toString(); logStream.write(c); });

async function waitUp() {
  for (let i = 0; i < 180; i++) {
    try { const r = await fetch(`${BASE}/consents/current`); if (r.status === 401 || r.ok) return; } catch { /* */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('backend did not start\n' + logText.slice(-2000));
}
async function call(method, p, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text, p, method };
}

const failures = [];
const note = (scenario, r) => { if (r.status >= 300 && !r.expected) failures.push({ scenario, method: r.method, path: r.p, status: r.status, body: r.text.slice(0, 800), requestId: r.json?.requestId ?? null }); };

const client = new pg.Client({ connectionString: DB });
await client.connect();
const { rows: docs } = await client.query('select code, version, "documentHash" from "ConsentDocuments" where "isActive" = true');

async function register(label) {
  const s = String(Date.now()).slice(-7) + randomInt(10, 99);
  const mobileNumber = `9${s.padStart(9, '0')}`.slice(0, 10);
  const reg = await call('POST', '/auth/register', undefined, {
    fullName: 'Capture', email: `cap${label}${s}@example.test`, password: 'Secret123', countryCode: '+91', mobileNumber,
    profileCreatedBy: 'myself', gender: 'male', language: 'en',
    consents: docs.map((d) => ({ code: d.code, version: d.version, documentHash: d.documentHash })),
  });
  note(`${label}:register`, reg);
  const ver = await call('POST', '/auth/otp/verify', undefined, { countryCode: '+91', mobileNumber, otpCode: reg.json?.otpCode, otpToken: reg.json?.otpToken });
  note(`${label}:verify`, ver);
  const token = ver.json?.accessToken ?? ver.json?.tokens?.accessToken;
  if (!token) return null;
  await client.query(`update "Users" set "profileReviewStatus"='approved',"accountStatus"='active' where id=$1`, [reg.json.userId]);
  return { token, userId: reg.json.userId };
}

const summary = { iterations: ITER, scenarios: {} };
const bump = (k, statuses) => { const o = (summary.scenarios[k] ??= {}); for (const s of statuses) o[s] = (o[s] ?? 0) + 1; };

try {
  await waitUp();
  for (const par of [4, 10]) {
    for (let i = 0; i < ITER; i++) {
      const m = await register(`sl${par}`);
      if (!m) continue;
      const rs = await Promise.all(Array.from({ length: par }, () => call('GET', '/shortlists', m.token)));
      rs.forEach((r) => note(`shortlists-first-get-x${par}#${i}`, r));
      bump(`shortlists first GET x${par}`, rs.map((r) => r.status));
      const n = (await client.query('select count(*)::int n from "ShortlistLists" where "userId"=$1', [m.userId])).rows[0].n;
      if (n !== 1) failures.push({ scenario: `shortlists-first-get-x${par}#${i}`, status: 'ROWCOUNT', body: `rows=${n}` });
    }
  }
  // consents module: the endpoint consent-verify.api.mjs hits (GET /consents/current and POST /consents) after register+verify
  for (const par of [1, 4, 10]) {
    for (let i = 0; i < ITER; i++) {
      const m = await register(`co${par}`);
      if (!m) continue;
      const rs = await Promise.all(Array.from({ length: par }, () => call('GET', '/consents/current?language=hi', m.token)));
      rs.forEach((r) => note(`consents-current-x${par}#${i}`, r));
      bump(`consents GET /consents/current x${par}`, rs.map((r) => r.status));
      const ps = await Promise.all(Array.from({ length: par }, () => call('POST', '/consents', m.token, { code: docs[0].code, version: docs[0].version, documentHash: docs[0].documentHash })));
      ps.forEach((r) => note(`consents-post-x${par}#${i}`, r));
      bump(`consents POST /consents x${par}`, ps.map((r) => r.status));
    }
  }
} finally {
  await new Promise((r) => setTimeout(r, 500));
  child.kill();
  await client.end().catch(() => {});
}
await new Promise((r) => setTimeout(r, 500));
for (const f of failures) {
  f.logLines = f.requestId ? logText.split('\n').filter((l) => l.includes(f.requestId)).slice(0, 30) : [];
}
summary.failureCount = failures.length;
writeFileSync(path.join(ART, 'capture-failures.json'), JSON.stringify({ summary, failures }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`appLogBytes=${logText.length} logFile=${logPath}`);
console.log(`failures -> ${path.join(ART, 'capture-failures.json')}`);
