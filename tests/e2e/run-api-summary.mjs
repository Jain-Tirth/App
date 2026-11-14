// Helper: runs the API harness and prints only non-PASS rows (the tool truncates long output).
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const r = spawnSync('npm', ['--prefix', 'Backend', 'run', 'test:api'], { encoding: 'utf8', shell: true, maxBuffer: 1 << 28 });
const out = (r.stdout || '') + (r.stderr || '');
writeFileSync('.loop/artifacts/test-api-rerun.log', out);
const rows = out.split('\n').filter((l) => l.includes(' | '));
const counts = {};
for (const l of rows) { const s = (l.split('|')[2] || '').trim(); counts[s] = (counts[s] || 0) + 1; }
console.log('exit', r.status, JSON.stringify(counts));
for (const l of rows) { const s = (l.split('|')[2] || '').trim(); if (s !== 'PASS' && s !== 'Status') console.log(l.replace(/\s+/g, ' ').slice(0, 500)); }
console.log(out.split('\n').filter((l) => /error|failed/i.test(l)).slice(0, 10).join('\n'));
