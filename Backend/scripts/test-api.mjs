#!/usr/bin/env node
/**
 * Runs every `tests/e2e/*.api.mjs` contract suite against a real backend.
 *
 * - builds the backend
 * - boots `dist/main.js` on a dedicated port against the test database
 * - imports each suite, which receives { baseUrl, databaseUrl }
 * - prints a per-criterion table and exits non-zero when anything fails
 *
 * Run `npm run test:env` once before this, and again after adding a migration.
 */
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import {
  BACKEND_DIR,
  REPO_DIR,
  TEST_API_PORT,
  TEST_API_URL,
  TEST_DATABASE_URL,
  run,
} from './test-db.mjs';

const E2E_DIR = path.join(REPO_DIR, 'tests', 'e2e');
const STARTUP_TIMEOUT_MS = 90_000;

function bootBackend() {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      PORT: String(TEST_API_PORT),
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  return {
    child,
    getOutput: () => output,
  };
}

async function waitForApi(getOutput) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${TEST_API_URL}/consents/current`);
      if (response.status === 401 || response.ok) {
        return;
      }
    } catch {
      // not listening yet
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`backend did not start on ${TEST_API_URL}\n${getOutput()}`);
}

async function loadSuites() {
  const entries = await readdir(E2E_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.api.mjs'))
    .map((entry) => entry.name)
    .sort();

  const suites = [];
  for (const file of files) {
    const module = await import(
      pathToFileURL(path.join(E2E_DIR, file)).href
    );
    if (typeof module.run !== 'function') {
      throw new Error(`${file} does not export a run() function`);
    }
    suites.push({
      file,
      name: module.name ?? file,
      run: module.run,
    });
  }

  return suites;
}

function printTable(rows) {
  const header = ['Suite', 'AC', 'Status', 'Evidence'];
  const all = [header, ...rows];
  const widths = header.map((_, index) =>
    Math.max(...all.map((row) => String(row[index]).length)),
  );

  for (const row of all) {
    const line = row
      .map((cell, index) => String(cell).padEnd(widths[index]))
      .join(' | ');
    console.log(line);
  }
}

async function main() {
  console.log('[test:api] building backend');
  run('npm', ['run', 'build'], { cwd: BACKEND_DIR });

  const suites = await loadSuites();
  if (suites.length === 0) {
    throw new Error(`no *.api.mjs suites found in ${E2E_DIR}`);
  }

  console.log(`[test:api] booting backend on ${TEST_API_URL}`);
  const backend = bootBackend();
  const db = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  const database = {
    query: (sql, params) => db.query(sql, params),
  };

  const rows = [];
  let failures = 0;

  try {
    await waitForApi(backend.getOutput);
    console.log('[test:api] backend is up');

    for (const suite of suites) {
      console.log(`\n[test:api] ${suite.name} (${suite.file})`);
      let results;
      try {
        results = await suite.run({
          baseUrl: TEST_API_URL,
          databaseUrl: TEST_DATABASE_URL,
          database,
        });
      } catch (error) {
        failures += 1;
        rows.push([suite.file, '-', 'FAIL', `suite crashed: ${error.message}`]);
        console.error(`[test:api] ${suite.file} crashed: ${error.message}`);
        continue;
      }

      for (const result of results) {
        if (result.status !== 'PASS') {
          failures += 1;
        }
        rows.push([
          suite.file,
          result.ac,
          result.status,
          result.evidence,
        ]);
      }
    }
  } finally {
    backend.child.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await db.end().catch(() => {});
  }

  console.log('\n[test:api] results');
  printTable(rows);
  console.log(
    `\n[test:api] ${rows.length - failures}/${rows.length} criteria passed`,
  );

  if (failures > 0) {
    console.error('[test:api] FAIL');
    process.exit(1);
  }

  console.log('[test:api] PASS');
}

main().catch((error) => {
  console.error(`[test:api] FAILED: ${error.message}`);
  process.exit(1);
});
