// Fails (exit 1) when the initial route JavaScript exceeds the gzip budget.
// Initial route JS = the entry script and every modulepreload chunk named by dist/index.html.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_BYTES = 250 * 1024;
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const urls = new Set();
for (const match of html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) urls.add(match[1]);
for (const match of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)) urls.add(match[1]);

if (urls.size === 0) {
  console.error('[bundle-size] no initial JavaScript found in dist/index.html');
  process.exit(1);
}

let total = 0;
for (const url of urls) {
  const file = join(dist, url.replace(/^\//, ''));
  const gz = gzipSync(readFileSync(file)).length;
  total += gz;
  console.log(`[bundle-size] ${url}  ${(gz / 1024).toFixed(1)} KB gzipped`);
}

console.log(`[bundle-size] service worker emitted: ${existsSync(join(dist, 'sw.js')) ? 'dist/sw.js' : 'MISSING'}`);
console.log(`[bundle-size] initial route JS total: ${(total / 1024).toFixed(1)} KB gzipped (budget ${BUDGET_BYTES / 1024} KB)`);

if (!existsSync(join(dist, 'sw.js'))) {
  console.error('[bundle-size] FAIL: dist/sw.js is missing');
  process.exit(1);
}
if (total > BUDGET_BYTES) {
  console.error('[bundle-size] FAIL: initial route JavaScript is over budget');
  process.exit(1);
}
