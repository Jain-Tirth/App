/**
 * Test harness for the AdminPanel ReviewPage UI check (story 4, AC8).
 * Boots the backend (dist/main.js) on the TEST port against the TEST database with the fake
 * storage provider (same env approach as Backend/scripts/test-api.mjs), seeds an admin and a
 * review queue, writes the fixtures to .loop/artifacts/ui-seed.json and stays alive until killed.
 * Usage: node tests/e2e/admin-review-ui-server.mjs
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { BACKEND_DIR, REPO_DIR, TEST_API_PORT, TEST_API_URL, TEST_DATABASE_URL } from '../../Backend/scripts/test-db.mjs';

const req = createRequire(path.join(BACKEND_DIR, 'package.json'));
const pg = req('pg');
const bcrypt = req('bcrypt');
const HOUR = 3_600_000;
const IST = 19_800_000;
const dayStartIst = (ms) => Math.floor((ms + IST) / 86_400_000) * 86_400_000 - IST;
const isBizDay = (d) => { const w = new Date(d + IST).getUTCDay(); return w >= 1 && w <= 5; };
function minusBiz(to, ms) {
  let remaining = ms; const cursor = to;
  for (let d = dayStartIst(to); ; d -= 86_400_000) {
    if (!isBizDay(d)) continue;
    const open = d + 9 * HOUR;
    const end = Math.min(d + 18 * HOUR, cursor);
    if (end <= open) continue;
    if (end - open >= remaining) return end - remaining;
    remaining -= end - open;
  }
}

const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: BACKEND_DIR,
  env: {
    ...process.env,
    DATABASE_URL: TEST_DATABASE_URL,
    PORT: String(TEST_API_PORT),
    NODE_ENV: 'development',
    STORAGE_PROVIDER: 'fake',
    KYC_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
process.on('SIGINT', () => { child.kill(); process.exit(0); });
process.on('SIGTERM', () => { child.kill(); process.exit(0); });
child.on('exit', () => process.exit(0));

for (let i = 0; i < 180; i++) {
  try { const r = await fetch(`${TEST_API_URL}/consents/current`); if (r.status === 401 || r.ok) break; } catch { /* wait */ }
  await new Promise((r) => setTimeout(r, 500));
}

const db = new pg.Client({ connectionString: TEST_DATABASE_URL });
await db.connect();
const tag0 = Date.now();
let seq = 0;
async function seed(name, hoursBiz, dob = '1995-05-05', gender = 'male') {
  const userId = randomUUID();
  const tag = `${tag0}${seq++}`;
  await db.query(`insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus",gender) values($1,$2,$3,'x',$4,'user','pending',$5)`,
    [userId, name, `ui${tag}@example.test`, `8${tag.slice(-9).padStart(9, '0')}`, gender]);
  const p = await db.query(`insert into "Profiles"(id,"userId","profileUid") values(gen_random_uuid(),$1,$2) returning id`, [userId, `U${tag.slice(-10)}`]);
  await db.query('insert into "ProfilePersonal"("profileId","dateOfBirth") values($1,$2)', [p.rows[0].id, dob]);
  const k = await db.query(`insert into "KycVerifications"("userId",status,"providerSessionId","documentType","idNumberEncrypted","idNumberLast4") values($1,'needsReview',$2,'pan','enc-not-real','234F') returning id`, [userId, `sess-${tag}`]);
  const at = new Date(minusBiz(Date.now(), hoursBiz * HOUR));
  for (const purpose of ['kycPhoto', 'kycId']) {
    await db.query(`insert into "KycMedia"(id,"verificationId","userId",purpose,"contentType","sizeBytes","storageKey",checksum,"attachedAt") values(gen_random_uuid(),$1,$2,$3,'image/jpeg',1000,$4,'ab',$5)`,
      [k.rows[0].id, userId, purpose, `kyc/${userId}/${purpose}-${tag}`, at]);
  }
  return userId;
}

const email = `uiadmin${tag0}@example.test`;
const password = 'AdminPass123!';
await db.query(`insert into "Users"(id,name,email,"passwordHash",mobile,role,"accountStatus") values($1,'UI Admin',$2,$3,$4,'admin','active')`,
  [randomUUID(), email, await bcrypt.hash(password, 10), `7${String(tag0).slice(-9)}`]);

const seeds = {
  overdue: await seed('UI Overdue Reject', 49),
  atRisk: await seed('UI AtRisk Changes', 40),
  ok: await seed('UI Ok Approve', 2),
  underAge: await seed('UI Under Age', 1, '2012-01-01'),
};
await mkdir(path.join(REPO_DIR, '.loop', 'artifacts'), { recursive: true });
await writeFile(path.join(REPO_DIR, '.loop', 'artifacts', 'ui-seed.json'), JSON.stringify({ email, password, seeds, api: TEST_API_URL }, null, 2));
console.log('[ui-server] ready; seed written');
await new Promise(() => {});
