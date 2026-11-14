/**
 * Runs the UserWeb Playwright specs with UserWeb's own @playwright/test CLI (the one the specs import).
 * Usage: node tests/e2e/run-userweb-ui.mjs [extra playwright args, e.g. --grep AC3]
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const userWeb = path.join(repo, 'UserWeb');
const cli = path.join(userWeb, 'node_modules', '@playwright', 'test', 'cli.js');
const config = path.join(repo, 'tests', 'e2e', 'userweb', 'playwright.config.ts');

const child = spawn(process.execPath, [cli, 'test', '-c', config, '--reporter=list', ...process.argv.slice(2)], {
  cwd: userWeb,
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
