import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { DatabaseClient } from '../database/database.types';
import type { StepUpAttempt, StepUpRepository } from './account.types';

type Db = Pick<DatabaseService, 'transaction'>;

function attemptOn(client: DatabaseClient, userId: string): StepUpAttempt {
  return {
    async findPasswordHash() {
      const result = await client.query(
        `SELECT "passwordHash" FROM "Users" WHERE "id" = $1`,
        [userId],
      );

      return result.rows[0]?.passwordHash ?? null;
    },

    async failuresSince(since) {
      const result = await client.query(
        `SELECT count(*)::int AS "count", min("failedAt") AS "oldestAt"
         FROM "StepUpFailures" WHERE "userId" = $1 AND "failedAt" > $2`,
        [userId, since],
      );
      const row = result.rows[0];

      return {
        count: row.count,
        oldestAt: row.oldestAt ? new Date(row.oldestAt) : null,
      };
    },

    async recordFailure(at) {
      await client.query(
        `INSERT INTO "StepUpFailures" ("userId", "failedAt") VALUES ($1, $2)`,
        [userId, at],
      );
    },
  };
}

@Injectable()
export class PostgresStepUpRepository implements StepUpRepository {
  constructor(@Inject(DatabaseService) private readonly db: Db) {}

  runExclusive<T>(
    userId: string,
    work: (attempt: StepUpAttempt) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (client) => {
      // Transaction-scoped advisory lock keyed on the member: released at
      // COMMIT or ROLLBACK, so it cannot leak.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `step-up:${userId}`,
      ]);

      return work(attemptOn(client, userId));
    });
  }
}
