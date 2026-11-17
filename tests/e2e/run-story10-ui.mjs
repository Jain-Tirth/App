/**
 * Runs the story 10 PWA Playwright specs with AdminPanel's @playwright/test CLI.
 * A service worker registers in PRODUCTION builds only, so this launcher first builds UserWeb into
 * .loop/artifacts/dist10 (own outDir, API base pointed at the TEST backend on 3101) and the Playwright
 * config serves that build with tests/e2e/story10/static-server.mjs on port 5191.
 * Usage: node tests/e2e/run-story10-ui.mjs [extra playwright args, e.g. --grep AC3]
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const admin = path.join(repo, 'AdminPanel');
const userWeb = path.join(repo, 'UserWeb');
const cli = path.join(admin, 'node_modules', '@playwright', 'test', 'cli.js');
const config = path.join(repo, 'tests', 'e2e', 'story10', 'playwright.config.ts');
const outDir = path.join(repo, '.loop', 'artifacts', 'dist10');

const build = spawnSync(
  process.execPath,
  [path.join(userWeb, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'],
  { cwd: userWeb, stdio: 'inherit', env: { ...process.env, VITE_BASE_URL: 'http://127.0.0.1:3101/api/v1' } },
);
if (build.status !== 0) {
  console.error('[story10] UserWeb build failed');
  process.exit(build.status ?? 1);
}

const child = spawn(process.execPath, [cli, 'test', '-c', config, '--reporter=list', ...process.argv.slice(2)], {
  cwd: admin,
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
