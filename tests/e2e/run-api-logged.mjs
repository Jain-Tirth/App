// Like Backend/scripts/test-api.mjs but keeps the app log and writes full (untruncated) rows to files.
// Usage: node tests/e2e/run-api-logged.mjs <tag>   (build first: npm --prefix Backend run build)
// Outputs: .loop/artifacts/api-run-<tag>.log (app stdout+stderr), api-run-<tag>-rows.txt (every row, full evidence)
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BACKEND = path.join(REPO, 'Backend');
const ART = path.join(REPO, '.loop', 'artifacts');
mkdirSync(ART, { recursive: true });
const tag = process.argv[2] ?? 'run';
const require = createRequire(path.join(BACKEND, 'package.json'));
const pg = require('pg');
const DB = 'postgresql://postgres:postgres@localhost:5428/dhobi_matrimony_test';
const BASE = 'http://127.0.0.1:3101/api/v1';

const logStream = createWriteStream(path.join(ART, `api-run-${tag}.log`));
const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: BACKEND,
  env: { ...process.env, DATABASE_URL: DB, PORT: '3101', NODE_ENV: 'development', STORAGE_PROVIDER: 'fake', KYC_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(logStream, { end: false });
child.stderr.pipe(logStream, { end: false });

for (let i = 0; i < 180; i++) {
  try { const r = await fetch(`${BASE}/consents/current`); if (r.status === 401 || r.ok) break; } catch { /* */ }
  await new Promise((r) => setTimeout(r, 500));
}
const db = new pg.Client({ connectionString: DB });
await db.connect();
const database = { query: (s, p) => db.query(s, p) };
const files = readdirSync(HERE).filter((f) => f.endsWith('.api.mjs')).sort();
const rows = [];
for (const f of files) {
  try {
    const m = await import(pathToFileURL(path.join(HERE, f)).href);
    for (const r of await m.run({ baseUrl: BASE, databaseUrl: DB, database })) rows.push([f, r.ac, r.status, r.evidence]);
  } catch (e) { rows.push([f, '-', 'FAIL', `suite crashed: ${e.message}`]); }
}
child.kill();
await new Promise((r) => setTimeout(r, 500));
await db.end().catch(() => {});
writeFileSync(path.join(ART, `api-run-${tag}-rows.txt`), rows.map((r) => r.join(' | ')).join('\n'));
const counts = {};
for (const r of rows) counts[r[2]] = (counts[r[2]] ?? 0) + 1;
console.log(`tag=${tag} rows=${rows.length} ${JSON.stringify(counts)}`);
for (const r of rows) if (r[2] !== 'PASS') console.log(`NONPASS ${r[0]} ${r[1]} ${r[3]}`.slice(0, 1500));
console.log(`files: api-run-${tag}.log api-run-${tag}-rows.txt`);
