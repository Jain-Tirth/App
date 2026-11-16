import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { PurgeCandidate, PurgeRepository } from './account.types';
import { recordAccountAudit } from './postgres-account-audit';

type Db = Pick<DatabaseService, 'query' | 'transaction'>;

const BATCH_SIZE = 500;

@Injectable()
export class PostgresPurgeRepository implements PurgeRepository {
  constructor(@Inject(DatabaseService) private readonly db: Db) {}

  async findDue(now: Date): Promise<PurgeCandidate[]> {
    const result = await this.db.query(
      `SELECT "id" FROM "Users"
       WHERE "role" = 'user'
         AND "deletionScheduledPurgeAt" IS NOT NULL
         AND "deletionScheduledPurgeAt" <= $1
       ORDER BY "deletionScheduledPurgeAt", "id"
       LIMIT ${BATCH_SIZE}`,
      [now],
    );

    return result.rows.map((row) => ({ userId: row.id }));
  }

  async findStorageKeys(userId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT "storageKey" FROM "KycMedia" WHERE "userId" = $1`,
      [userId],
    );

    return result.rows.map((row) => row.storageKey);
  }

  /**
   * Kept, with identity stripped: "ConsentRecords" (userId, userName, ip and
   * userAgent cleared), "AccountAuditLog" (userId, ip and user agent cleared,
   * plus one new purge_executed row) and "AdminAuditLog" (the link to the
   * member, notes, ip and user agent cleared). Everything else the member owns goes with the
   * "Users" row (ON DELETE CASCADE) or is deleted explicitly below because its
   * foreign key is RESTRICT.
   */
  async purge(userId: string, now: Date): Promise<boolean> {
    return this.db.transaction(async (client) => {
      const due = await client.query(
        `SELECT "id" FROM "Users"
         WHERE "id" = $1 AND "role" = 'user'
           AND "deletionScheduledPurgeAt" IS NOT NULL
           AND "deletionScheduledPurgeAt" <= $2
         FOR UPDATE`,
        [userId, now],
      );

      if (due.rows.length === 0) {
        return false;
      }

      // Names the member for the append-only triggers: the anonymising
      // updates below are allowed only for this member, only in this
      // transaction (is_local), and only while the schedule row exists.
      await client.query(`SELECT set_config('app.purge_user_id', $1, true)`, [userId]);
      await client.query(
        `UPDATE "ConsentRecords"
         SET "userId" = NULL, "userName" = '', "ip" = '', "userAgent" = ''
         WHERE "userId" = $1`,
        [userId],
      );
      await client.query(
        `UPDATE "AccountAuditLog"
         SET "userId" = NULL, "ip" = '', "userAgent" = ''
         WHERE "userId" = $1`,
        [userId],
      );
      // The purge's own row carries no member link: the member is gone.
      await recordAccountAudit(client, {
        userId: null,
        eventType: 'purge_executed',
        context: { ip: '', userAgent: '' },
      });
      await client.query(
        `UPDATE "AdminAuditLog"
         SET "targetId" = CASE WHEN "targetId" = $1 THEN NULL ELSE "targetId" END,
             "relatedId" = CASE WHEN "relatedId" = $1 THEN NULL ELSE "relatedId" END,
             "notes" = NULL, "ipAddress" = NULL, "userAgent" = NULL
         WHERE "targetId" = $1 OR "relatedId" = $1`,
        [userId],
      );
      // Messages go with their conversation (ON DELETE CASCADE).
      await client.query(
        `DELETE FROM "Conversations" WHERE "user1Id" = $1 OR "user2Id" = $1`,
        [userId],
      );
      await client.query(
        `DELETE FROM "ProfileViews" WHERE "viewerId" = $1 OR "viewedId" = $1`,
        [userId],
      );
      await client.query(`DELETE FROM "Users" WHERE "id" = $1`, [userId]);

      return true;
    });
  }
}
