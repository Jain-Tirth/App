#!/usr/bin/env node
/**
 * Prepares the disposable test database used by `npm run test:api`.
 *
 * 1. starts the Postgres service from docker-compose.yml
 * 2. waits until it accepts connections
 * 3. creates the test database if it does not exist
 * 4. runs every migration against it
 *
 * It never touches the development database.
 */
import {
  BACKEND_DIR,
  CONTAINER,
  REPO_DIR,
  TEST_DB,
  TEST_DATABASE_URL,
  capture,
  run,
  waitForPostgres,
  withClient,
} from './test-db.mjs';

async function main() {
  console.log(`[test-env] starting Postgres (${CONTAINER})`);
  run('docker', ['compose', 'up', '-d', 'postgres'], { cwd: REPO_DIR });
  await waitForPostgres();
  console.log('[test-env] Postgres is reachable');

  const exists = await withClient(TEST_DATABASE_URL, async () => true).catch(
    () => false,
  );

  if (!exists) {
    console.log(`[test-env] creating database ${TEST_DB}`);
    run('docker', ['exec', CONTAINER, 'createdb', '-U', 'postgres', TEST_DB]);
  } else {
    console.log(`[test-env] database ${TEST_DB} already exists`);
  }

  console.log('[test-env] running migrations against the test database');
  run('npm', ['run', 'migrate:up'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  const { rows } = await withClient(TEST_DATABASE_URL, (client) =>
    client.query(
      'select count(*)::int as documents from "ConsentDocuments" where "isActive" = true',
    ),
  );

  console.log(
    `[test-env] ready: ${rows[0].documents} active consent documents in ${TEST_DB}`,
  );
  console.log(`[test-env] DATABASE_URL=${TEST_DATABASE_URL}`);

  const health = capture('docker', [
    'inspect',
    '--format',
    '{{.State.Health.Status}}',
    CONTAINER,
  ]);
  if (health && health !== 'healthy') {
    console.warn(`[test-env] warning: container health is "${health}"`);
  }
}

main().catch((error) => {
  console.error(`[test-env] FAILED: ${error.message}`);
  process.exit(1);
});
