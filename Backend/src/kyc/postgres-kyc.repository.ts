import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { DatabaseClient } from '../database/database.types';
import type {
  AttachMediaInput,
  AttachMediaOutcome,
  IdDetails,
  KycRepository,
  NewPendingMedia,
  RestartInput,
  RestartOutcome,
} from './kyc.repository';
import type {
  KycCase,
  KycDocumentType,
  KycMedia,
  KycPurpose,
  KycStatus,
} from './kyc.types';

interface CaseRow {
  id: string;
  userId: string;
  status: KycStatus;
  providerSessionId: string;
  documentType: KycDocumentType | null;
  idNumberEncrypted: string | null;
  idNumberLast4: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface MediaRow {
  id: string;
  verificationId: string;
  userId: string;
  purpose: KycPurpose;
  contentType: string;
  sizeBytes: string | number;
  storageKey: string;
  checksum: string | null;
  attachedAt: Date | string | null;
  createdAt: Date | string;
}

const CASE_COLUMNS = `"id", "userId", "status", "providerSessionId", "documentType",
  "idNumberEncrypted", "idNumberLast4", "createdAt", "updatedAt"`;
const MEDIA_COLUMNS = `"id", "verificationId", "userId", "purpose", "contentType",
  "sizeBytes", "storageKey", "checksum", "attachedAt", "createdAt"`;
const RESTART_WINDOW_SQL = `INTERVAL '24 hours'`;

@Injectable()
export class PostgresKycRepository implements KycRepository {
  constructor(private readonly db: DatabaseService) {}

  async findCaseByUser(userId: string): Promise<KycCase | null> {
    const result = await this.db.query<CaseRow>(
      `SELECT ${CASE_COLUMNS} FROM "KycVerifications" WHERE "userId" = $1`,
      [userId],
    );

    return result.rows[0] ? this.mapCase(result.rows[0]) : null;
  }

  async createCase(input: {
    userId: string;
    status: KycStatus;
    providerSessionId: string;
  }): Promise<KycCase | null> {
    const result = await this.db.query<CaseRow>(
      `INSERT INTO "KycVerifications" ("userId", "status", "providerSessionId")
       VALUES ($1, $2, $3)
       ON CONFLICT ("userId") DO NOTHING
       RETURNING ${CASE_COLUMNS}`,
      [input.userId, input.status, input.providerSessionId],
    );

    return result.rows[0] ? this.mapCase(result.rows[0]) : null;
  }

  async setIdDetails(verificationId: string, details: IdDetails): Promise<void> {
    await this.db.query(
      `UPDATE "KycVerifications"
       SET "documentType" = $2, "idNumberEncrypted" = $3, "idNumberLast4" = $4,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1`,
      [
        verificationId,
        details.documentType,
        details.idNumberEncrypted,
        details.idNumberLast4,
      ],
    );
  }

  async insertPendingMedia(input: NewPendingMedia): Promise<KycMedia> {
    const result = await this.db.query<MediaRow>(
      `INSERT INTO "KycMedia"
         ("id", "verificationId", "userId", "purpose", "contentType", "sizeBytes", "storageKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${MEDIA_COLUMNS}`,
      [
        input.id,
        input.verificationId,
        input.userId,
        input.purpose,
        input.contentType,
        input.sizeBytes,
        input.storageKey,
      ],
    );

    return this.mapMedia(result.rows[0]);
  }

  async findMedia(userId: string, mediaId: string): Promise<KycMedia | null> {
    const result = await this.db.query<MediaRow>(
      `SELECT ${MEDIA_COLUMNS} FROM "KycMedia" WHERE "id" = $1 AND "userId" = $2`,
      [mediaId, userId],
    );

    return result.rows[0] ? this.mapMedia(result.rows[0]) : null;
  }

  async listAttachedMedia(verificationId: string): Promise<KycMedia[]> {
    const result = await this.db.query<MediaRow>(
      `SELECT ${MEDIA_COLUMNS} FROM "KycMedia"
       WHERE "verificationId" = $1 AND "attachedAt" IS NOT NULL
       ORDER BY "purpose" ASC`,
      [verificationId],
    );

    return result.rows.map((row) => this.mapMedia(row));
  }

  async deleteMedia(mediaId: string): Promise<void> {
    await this.db.query(`DELETE FROM "KycMedia" WHERE "id" = $1`, [mediaId]);
  }

  async attachMedia(input: AttachMediaInput): Promise<AttachMediaOutcome> {
    return this.db.transaction(async (client) => {
      const target = await this.lockMedia(client, input.userId, input.mediaId);
      const verification = await this.lockCaseById(client, target.verificationId);
      const attached = await client.query(
        `SELECT "id", "purpose", "storageKey" FROM "KycMedia"
         WHERE "verificationId" = $1 AND "attachedAt" IS NOT NULL`,
        [verification.id],
      );
      const previous = attached.rows.find(
        (row) => row.purpose === target.purpose && row.id !== target.id,
      );
      const purposes = new Set<KycPurpose>(attached.rows.map((row) => row.purpose));
      purposes.add(target.purpose);
      const nextStatus = input.decideStatus(verification, [...purposes]);

      if (previous) {
        await client.query(`DELETE FROM "KycMedia" WHERE "id" = $1`, [previous.id]);
      }

      await client.query(
        `UPDATE "KycMedia" SET "checksum" = $2, "attachedAt" = $3 WHERE "id" = $1`,
        [target.id, input.checksum, input.now],
      );
      const updated = await client.query(
        `UPDATE "KycVerifications" SET "status" = $2, "updatedAt" = $3
         WHERE "id" = $1 RETURNING ${CASE_COLUMNS}`,
        [verification.id, nextStatus, input.now],
      );

      return {
        verification: this.mapCase(updated.rows[0] as CaseRow),
        replacedStorageKey: previous?.storageKey ?? null,
      };
    });
  }

  async restartCase(input: RestartInput): Promise<RestartOutcome> {
    return this.db.transaction(async (client): Promise<RestartOutcome> => {
      const locked = await client.query(
        `SELECT ${CASE_COLUMNS} FROM "KycVerifications"
         WHERE "userId" = $1 FOR UPDATE`,
        [input.userId],
      );

      if (!locked.rows[0]) {
        return { kind: 'notFound' };
      }

      const verification = this.mapCase(locked.rows[0] as CaseRow);
      const history = await client.query(
        `SELECT "restartedAt" FROM "KycRestarts"
         WHERE "verificationId" = $1 AND "restartedAt" > $2::timestamptz - ${RESTART_WINDOW_SQL}`,
        [verification.id, input.now],
      );
      const plan = input.decide(
        verification,
        history.rows.map((row) => new Date(row.restartedAt)),
      );

      if (plan.kind === 'blocked') {
        return plan;
      }

      const removed = await client.query(
        `DELETE FROM "KycMedia" WHERE "verificationId" = $1 RETURNING "storageKey"`,
        [verification.id],
      );
      await client.query(
        `INSERT INTO "KycRestarts" ("verificationId", "restartedAt") VALUES ($1, $2)`,
        [verification.id, input.now],
      );
      const updated = await client.query(
        `UPDATE "KycVerifications"
         SET "status" = $2, "documentType" = NULL, "idNumberEncrypted" = NULL,
             "idNumberLast4" = NULL, "updatedAt" = $3
         WHERE "id" = $1 RETURNING ${CASE_COLUMNS}`,
        [verification.id, plan.nextStatus, input.now],
      );

      return {
        kind: 'restarted',
        verification: this.mapCase(updated.rows[0] as CaseRow),
        removedStorageKeys: removed.rows.map((row) => row.storageKey as string),
      };
    });
  }

  private async lockMedia(
    client: DatabaseClient,
    userId: string,
    mediaId: string,
  ): Promise<KycMedia> {
    const result = await client.query(
      `SELECT ${MEDIA_COLUMNS} FROM "KycMedia"
       WHERE "id" = $1 AND "userId" = $2 FOR UPDATE`,
      [mediaId, userId],
    );

    if (!result.rows[0]) {
      throw new Error('KycMedia row disappeared before it could be attached.');
    }

    return this.mapMedia(result.rows[0] as MediaRow);
  }

  private async lockCaseById(
    client: DatabaseClient,
    verificationId: string,
  ): Promise<KycCase> {
    const result = await client.query(
      `SELECT ${CASE_COLUMNS} FROM "KycVerifications" WHERE "id" = $1 FOR UPDATE`,
      [verificationId],
    );

    return this.mapCase(result.rows[0] as CaseRow);
  }

  private mapCase(row: CaseRow): KycCase {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapMedia(row: MediaRow): KycMedia {
    return {
      ...row,
      sizeBytes: Number(row.sizeBytes),
      attachedAt: row.attachedAt ? new Date(row.attachedAt) : null,
      createdAt: new Date(row.createdAt),
    };
  }
}
