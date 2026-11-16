import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AccountPurgeService } from '../src/account/account-purge.service';
import { AppModule } from '../src/app.module';
import { validateEnv } from '../src/config/env';

/**
 * Purges every account whose deletion cooling-off has ended. Run it from a
 * scheduler (for example daily): `npm run account:purge`.
 */
async function main() {
  validateEnv();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const result = await app
      .get(AccountPurgeService, { strict: false })
      .run();

    console.log(`Account purge finished: ${result.purged} purged, ${result.failed} failed.`);
    process.exitCode = result.failed > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
