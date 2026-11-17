// Wall-time wrapper: node tests/e2e/timed-run.mjs <script> [args...]   e.g. run-api-logged.mjs t1
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [script, ...args] = process.argv.slice(2);
const t0 = Date.now();
const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], { stdio: 'inherit' });
console.log(`TIMED ${script} ${args.join(' ')} exit=${r.status} seconds=${((Date.now() - t0) / 1000).toFixed(1)}`);
