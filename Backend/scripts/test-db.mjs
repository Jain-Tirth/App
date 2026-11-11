import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const isWindows = process.platform === 'win32';

export const CONTAINER = 'dhobi-matrimony-postgres';
export const TEST_DB = 'dhobi_matrimony_test';
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:5428/${TEST_DB}`;
export const ADMIN_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5428/postgres';
export const TEST_API_PORT = 3101;
export const TEST_API_URL = `http://127.0.0.1:${TEST_API_PORT}/api/v1`;

export const BACKEND_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
export const REPO_DIR = path.resolve(BACKEND_DIR, '..');

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });
}

export function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      shell: isWindows,
      ...options,
    }).trim();
  } catch {
    return '';
  }
}

export async function connect(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

export async function withClient(url, fn) {
  const client = await connect(url);
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function waitForPostgres(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'not attempted';

  while (Date.now() < deadline) {
    try {
      const client = await connect(ADMIN_DATABASE_URL);
      await client.end();
      return;
    } catch (error) {
      lastError = error.message;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  throw new Error(`Postgres did not become reachable: ${lastError}`);
}
