/** Runs UserWeb's own TypeScript compiler as `tsc --noEmit` (UserWeb has no typecheck script). */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const userWeb = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'UserWeb');
const tsc = path.join(userWeb, 'node_modules', 'typescript', 'bin', 'tsc');
const child = spawn(process.execPath, [tsc, '--noEmit', '-p', userWeb], { cwd: userWeb, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
