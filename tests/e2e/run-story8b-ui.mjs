/**
 * Runs the story 8b Playwright specs with AdminPanel's @playwright/test CLI (same launcher shape as run-story7b-ui.mjs).
 * Usage: node tests/e2e/run-story8b-ui.mjs [extra playwright args, e.g. --grep AC6]
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const admin = path.join(repo, 'AdminPanel');
const cli = path.join(admin, 'node_modules', '@playwright', 'test', 'cli.js');
const config = path.join(repo, 'tests', 'e2e', 'story8b', 'playwright.config.ts');

const child = spawn(process.execPath, [cli, 'test', '-c', config, '--reporter=list', ...process.argv.slice(2)], {
  cwd: admin,
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
