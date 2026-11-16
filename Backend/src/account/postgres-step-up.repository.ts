import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { FailureWindow, StepUpRepository } from './account.types';

type Db = Pick<DatabaseService, 'query'>;

@Injectable()
export class PostgresStepUpRepository implements StepUpRepository {
  constructor(@Inject(DatabaseService) private readonly db: Db) {}

  async findPasswordHash(userId: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT "passwordHash" FROM "Users" WHERE "id" = $1`,
      [userId],
    );

    return result.rows[0]?.passwordHash ?? null;
  }

  async failuresSince(userId: string, since: Date): Promise<FailureWindow> {
    const result = await this.db.query(
      `SELECT count(*)::int AS "count", min("failedAt") AS "oldestAt"
       FROM "StepUpFailures" WHERE "userId" = $1 AND "failedAt" > $2`,
      [userId, since],
    );
    const row = result.rows[0];

    return {
      count: row.count,
      oldestAt: row.oldestAt ? new Date(row.oldestAt) : null,
    };
  }

  async recordFailure(userId: string, at: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO "StepUpFailures" ("userId", "failedAt") VALUES ($1, $2)`,
      [userId, at],
    );
  }
}
