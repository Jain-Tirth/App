import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  NOTIFICATION_KEYS,
  type AccountRepository,
  type AccountSettings,
  type CreateExportResult,
  type DeletionState,
  type ExportArchive,
  type ExportRequestRecord,
  type NotificationPrefs,
  type ScheduleDeletionResult,
  type SettingsPatch,
} from './account.types';

type Db = Pick<DatabaseService, 'query' | 'transaction'>;

const SETTINGS_COLUMNS = `"language", "notificationPrefs", "profileVisibility"`;
const EXPORT_COLUMNS = `"id", "status", "requestedAt", "expiresAt", "archive"`;

function toSettings(row: any): AccountSettings {
  const stored = (row.notificationPrefs ?? {}) as Partial<NotificationPrefs>;
  const notifications = {} as NotificationPrefs;

  for (const key of NOTIFICATION_KEYS) {
    notifications[key] = stored[key] ?? true;
  }

  return {
    language: row.language,
    notifications,
    profileVisibility: row.profileVisibility,
  };
}

function toExportRequest(row: any): ExportRequestRecord {
  return {
    id: row.id,
    status: row.status,
    requestedAt: new Date(row.requestedAt),
    expiresAt: new Date(row.expiresAt),
    archive: row.archive ?? null,
  };
}

function toDeletion(row: any): DeletionState {
  return {
    requestedAt: new Date(row.deletionRequestedAt),
    scheduledPurgeAt: new Date(row.deletionScheduledPurgeAt),
  };
}

@Injectable()
export class PostgresAccountRepository implements AccountRepository {
  constructor(@Inject(DatabaseService) private readonly db: Db) {}

  async getSettings(userId: string): Promise<AccountSettings | null> {
    const result = await this.db.query(
      `SELECT ${SETTINGS_COLUMNS} FROM "Users" WHERE "id" = $1`,
      [userId],
    );

    return result.rows[0] ? toSettings(result.rows[0]) : null;
  }

  async updateSettings(
    userId: string,
    patch: SettingsPatch,
  ): Promise<AccountSettings> {
    const result = await this.db.query(
      `UPDATE "Users"
       SET "language" = COALESCE($2::text, "language"),
           "profileVisibility" = COALESCE($3::text, "profileVisibility"),
           "notificationPrefs" = "notificationPrefs" || $4::jsonb,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1
       RETURNING ${SETTINGS_COLUMNS}`,
      [
        userId,
        patch.language ?? null,
        patch.profileVisibility ?? null,
        JSON.stringify(patch.notifications ?? {}),
      ],
    );

    return toSettings(result.rows[0]);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE "Users" SET "sessionVersion" = "sessionVersion" + 1,
                            "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $1`,
        [userId],
      );
      await client.query(`DELETE FROM "UserSessions" WHERE "userId" = $1`, [userId]);
    });
  }

  async createExportRequest(
    userId: string,
    now: Date,
    expiresAt: Date,
  ): Promise<CreateExportResult> {
    return this.db.transaction(async (client) => {
      // The member row is the lock that serialises concurrent requests.
      await client.query(`SELECT "id" FROM "Users" WHERE "id" = $1 FOR UPDATE`, [
        userId,
      ]);

      const pending = await client.query(
        `SELECT 1 FROM "AccountExportRequests"
         WHERE "userId" = $1 AND "status" = 'pending' AND "expiresAt" > $2`,
        [userId, now],
      );

      if (pending.rows.length > 0) {
        return { kind: 'alreadyPending' } as const;
      }

      const created = await client.query(
        `INSERT INTO "AccountExportRequests" ("userId", "requestedAt", "expiresAt")
         VALUES ($1, $2, $3) RETURNING ${EXPORT_COLUMNS}`,
        [userId, now, expiresAt],
      );

      return { kind: 'created', request: toExportRequest(created.rows[0]) } as const;
    });
  }

  async findExportRequest(
    userId: string,
    requestId: string,
  ): Promise<ExportRequestRecord | null> {
    const result = await this.db.query(
      `SELECT ${EXPORT_COLUMNS} FROM "AccountExportRequests"
       WHERE "id" = $1 AND "userId" = $2`,
      [requestId, userId],
    );

    return result.rows[0] ? toExportRequest(result.rows[0]) : null;
  }

  async storeExportArchive(
    requestId: string,
    archive: ExportArchive,
    now: Date,
  ): Promise<ExportRequestRecord> {
    const result = await this.db.query(
      `UPDATE "AccountExportRequests"
       SET "archive" = COALESCE("archive", $2::jsonb),
           "status" = 'ready',
           "generatedAt" = COALESCE("generatedAt", $3)
       WHERE "id" = $1
       RETURNING ${EXPORT_COLUMNS}`,
      [requestId, JSON.stringify(archive), now],
    );

    return toExportRequest(result.rows[0]);
  }

  /**
   * The member's own data only. Other members appear as a profile reference
   * and first name, the same card fields discovery shows; credentials, tokens
   * and the encrypted ID number are never selected.
   */
  async buildExportArchive(userId: string, now: Date): Promise<ExportArchive> {
    const profile = await this.db.query(
      `SELECT fn_get_profile_by_user_id($1) AS "profile"`,
      [userId],
    );
    const settings = await this.getSettings(userId);
    const kyc = await this.db.query(
      `SELECT "status", "documentType", "idNumberLast4", "createdAt", "updatedAt"
       FROM "KycVerifications" WHERE "userId" = $1`,
      [userId],
    );
    const photos = await this.db.query(
      `SELECT "id", "isPrimary", "sortOrder", "validationStatus", "uploadedAt"
       FROM "ProfilePhotos" WHERE "userId" = $1 ORDER BY "sortOrder", "uploadedAt"`,
      [userId],
    );
    const consents = await this.db.query(
      `SELECT "code", "version", "language", "textSnapshot", "grantedAt",
              "expiresAt", "revokedAt", "source"
       FROM "ConsentRecords" WHERE "userId" = $1 ORDER BY "grantedAt", "id"`,
      [userId],
    );
    const interests = await this.db.query(
      `SELECT i."id", i."status"::text AS "status", i."createdAt", i."respondedAt",
              CASE WHEN i."senderId" = $1 THEN 'sent' ELSE 'received' END AS "direction",
              p."profileRef" AS "profileRef",
              split_part(btrim(o."name"), ' ', 1) AS "firstName"
       FROM "Interests" i
         JOIN "Users" o
           ON o."id" = CASE WHEN i."senderId" = $1 THEN i."receiverId" ELSE i."senderId" END
         LEFT JOIN "Profiles" p ON p."userId" = o."id"
       WHERE i."senderId" = $1 OR i."receiverId" = $1
       ORDER BY i."createdAt", i."id"`,
      [userId],
    );
    const shortlists = await this.db.query(
      `SELECT l."id" AS "listId", l."name", l."isDefault", l."createdAt",
              sp."createdAt" AS "addedAt", p."profileRef" AS "profileRef"
       FROM "ShortlistLists" l
         LEFT JOIN "ShortlistProfiles" sp ON sp."listId" = l."id"
         LEFT JOIN "Profiles" p ON p."userId" = sp."targetId"
       WHERE l."userId" = $1
       ORDER BY l."createdAt", l."id", sp."createdAt"`,
      [userId],
    );

    const lists = new Map<string, any>();

    for (const row of shortlists.rows) {
      if (!lists.has(row.listId)) {
        lists.set(row.listId, {
          id: row.listId,
          name: row.name,
          isDefault: row.isDefault,
          createdAt: row.createdAt,
          profiles: [],
        });
      }

      if (row.profileRef) {
        lists.get(row.listId).profiles.push({
          profileRef: row.profileRef,
          addedAt: row.addedAt,
        });
      }
    }

    const asRecord = (row: any) => {
      const { direction, ...rest } = row;

      return rest;
    };

    return {
      format: 'dhobi-matrimony-export',
      version: 1,
      exportedAt: now.toISOString(),
      account: profile.rows[0]?.profile ?? null,
      settings,
      verification: kyc.rows[0] ?? null,
      photos: photos.rows,
      consents: consents.rows,
      interests: {
        sent: interests.rows.filter((row) => row.direction === 'sent').map(asRecord),
        received: interests.rows
          .filter((row) => row.direction === 'received')
          .map(asRecord),
      },
      shortlists: [...lists.values()],
    };
  }

  async scheduleDeletion(
    userId: string,
    requestedAt: Date,
    purgeAt: Date,
  ): Promise<ScheduleDeletionResult> {
    const result = await this.db.query(
      `UPDATE "Users"
       SET "deletionRequestedAt" = $2, "deletionScheduledPurgeAt" = $3,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1 AND "deletionRequestedAt" IS NULL
       RETURNING "deletionRequestedAt", "deletionScheduledPurgeAt"`,
      [userId, requestedAt, purgeAt],
    );

    return result.rows[0]
      ? { kind: 'scheduled', state: toDeletion(result.rows[0]) }
      : { kind: 'alreadyPending' };
  }

  async findDeletion(userId: string): Promise<DeletionState | null> {
    const result = await this.db.query(
      `SELECT "deletionRequestedAt", "deletionScheduledPurgeAt" FROM "Users"
       WHERE "id" = $1 AND "deletionRequestedAt" IS NOT NULL`,
      [userId],
    );

    return result.rows[0] ? toDeletion(result.rows[0]) : null;
  }

  async cancelDeletion(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE "Users"
       SET "deletionRequestedAt" = NULL, "deletionScheduledPurgeAt" = NULL,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1`,
      [userId],
    );
  }
}
