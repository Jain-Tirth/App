/** Runs AdminPanel's own TypeScript compiler as `tsc --noEmit` (AdminPanel build has no tsc step). */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const panel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'AdminPanel');
const tsc = path.join(panel, 'node_modules', 'typescript', 'bin', 'tsc');
const child = spawn(process.execPath, [tsc, '--noEmit', '-p', panel], { cwd: panel, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
