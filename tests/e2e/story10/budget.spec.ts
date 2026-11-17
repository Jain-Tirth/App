/**
 * Phase 1 story 10, AC8 (size budget script). The real script (UserWeb/scripts/check-bundle-size.mjs) is COPIED next to a
 * synthetic dist in a temp folder (it resolves ../dist relative to itself), so the source is never edited.
 */
import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '..', '..', '..', 'UserWeb', 'scripts', 'check-bundle-size.mjs');

function fixture(o: { chunkBytes: number; sw?: boolean; preload?: number }) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'budget10-'));
  mkdirSync(path.join(root, 'scripts'));
  mkdirSync(path.join(root, 'dist', 'assets'), { recursive: true });
  copyFileSync(SCRIPT, path.join(root, 'scripts', 'check-bundle-size.mjs'));
  const links = o.preload ? `<link rel="modulepreload" href="/assets/vendor.js">` : '';
  writeFileSync(path.join(root, 'dist', 'index.html'), `<!doctype html><html><head>${links}<script type="module" crossorigin src="/assets/index.js"></script></head><body></body></html>`);
  writeFileSync(path.join(root, 'dist', 'assets', 'index.js'), randomBytes(o.chunkBytes)); // random bytes do not compress
  if (o.preload) writeFileSync(path.join(root, 'dist', 'assets', 'vendor.js'), randomBytes(o.preload));
  if (o.sw !== false) writeFileSync(path.join(root, 'dist', 'sw.js'), '// sw');
  return path.join(root, 'scripts', 'check-bundle-size.mjs');
}
const run = (script: string) => spawnSync(process.execPath, [script], { encoding: 'utf8' });

test('budget: the real script on the real UserWeb/dist (from npm run build) exits 0 and is far below 250 KB', () => {
  const r = run(SCRIPT);
  writeFileSync(path.resolve(__dirname, '..', '..', '..', '.loop', 'artifacts', 'ui-10-bundle-check.txt'), r.stdout + r.stderr);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  const total = Number(/initial route JS total: ([\d.]+) KB/.exec(r.stdout)?.[1]);
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(250);
});

test('budget: a chunk well under 250 KB gzipped passes (exit 0) and prints the totals', () => {
  const r = run(fixture({ chunkBytes: 100 * 1024 }));
  expect(r.status, r.stderr).toBe(0);
  expect(r.stdout).toMatch(/initial route JS total: 10\d\.\d KB gzipped \(budget 250 KB\)/);
  expect(r.stdout).toContain('service worker emitted: dist/sw.js');
});

test('budget: an inflated initial chunk (400 KB incompressible) fails with a non-zero exit', () => {
  const r = run(fixture({ chunkBytes: 400 * 1024 }));
  expect(r.status).toBe(1);
  expect(r.stderr).toContain('over budget');
});

test('budget: the modulepreload chunks count towards the total (160 KB + 160 KB fails)', () => {
  const r = run(fixture({ chunkBytes: 160 * 1024, preload: 160 * 1024 }));
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/\/assets\/vendor\.js/);
});

test('budget: just under the limit passes, just over fails (250 KB = 256000 bytes)', () => {
  expect(run(fixture({ chunkBytes: 248 * 1024 })).status).toBe(0);
  expect(run(fixture({ chunkBytes: 252 * 1024 })).status).toBe(1);
});

test('budget edge: a missing sw.js fails the check even when the size is fine', () => {
  const r = run(fixture({ chunkBytes: 1024, sw: false }));
  expect(r.status).toBe(1);
  expect(r.stderr).toContain('sw.js is missing');
});
