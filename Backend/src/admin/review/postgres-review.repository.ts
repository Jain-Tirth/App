import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type {
  ProfileAccountStatus,
  ProfileReviewStatus,
} from '../../profiles/profile-status';
import type {
  DocumentViewEntry,
  ReviewRepository,
  ReviewState,
} from './review.repository';
import type {
  DecisionInput,
  DecisionOutcome,
  QueueRow,
  ReviewSubject,
  ReviewTransition,
} from './review.types';

interface QueueDbRow {
  userId: string;
  profileUid: string | null;
  name: string;
  submittedAt: Date | string;
}

interface SubjectDbRow {
  userId: string;
  profileUid: string | null;
  name: string;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  accountStatus: ProfileAccountStatus;
  profileReviewStatus: ProfileReviewStatus;
  profileSubmittedAt: Date | string | null;
  kycStatus: string | null;
  documentType: string | null;
  idNumberLast4: string | null;
}

interface MediaDbRow {
  purpose: 'kycPhoto' | 'kycId';
  storageKey: string;
  contentType: string;
  attachedAt: Date | string;
}

const PROCEDURE_BY_DECISION = {
  approve: 'sp_admin_approve_profile',
  reject: 'sp_admin_reject_profile',
  reopen: 'sp_admin_reopen_profile',
} as const;

@Injectable()
export class PostgresReviewRepository implements ReviewRepository {
  constructor(private readonly db: DatabaseService) {}

  async listAwaitingReview(): Promise<QueueRow[]> {
    const result = await this.db.query<QueueDbRow>(
      `SELECT u."id" AS "userId", p."profileUid", u."name",
              u."profileSubmittedAt" AS "submittedAt"
       FROM "v_profiles_awaiting_review" q
       JOIN "Users" u ON u."id" = q."userId"
       LEFT JOIN "Profiles" p ON p."userId" = u."id"
       ORDER BY u."profileSubmittedAt" ASC, u."id" ASC`,
    );

    return result.rows.map((row) => ({
      ...row,
      submittedAt: new Date(row.submittedAt),
    }));
  }

  async findSubject(userId: string): Promise<ReviewSubject | null> {
    const result = await this.db.query<SubjectDbRow>(
      `SELECT u."id" AS "userId", p."profileUid", u."name", u."gender",
              to_char(pp."dateOfBirth", 'YYYY-MM-DD') AS "dateOfBirth",
              u."accountStatus", u."profileReviewStatus", u."profileSubmittedAt",
              k."status" AS "kycStatus",
              k."documentType", k."idNumberLast4"
       FROM "Users" u
       LEFT JOIN "Profiles" p ON p."userId" = u."id"
       LEFT JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"
       LEFT JOIN "KycVerifications" k ON k."userId" = u."id"
       WHERE u."id" = $1 AND u."role" = 'user'`,
      [userId],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const media = await this.db.query<MediaDbRow>(
      `SELECT m."purpose", m."storageKey", m."contentType", m."attachedAt"
       FROM "KycMedia" m
       JOIN "KycVerifications" k ON k."id" = m."verificationId"
       WHERE k."userId" = $1 AND m."attachedAt" IS NOT NULL`,
      [userId],
    );
    const photo = media.rows.find((item) => item.purpose === 'kycPhoto');
    const id = media.rows.find((item) => item.purpose === 'kycId');
    const { profileSubmittedAt, ...fields } = row;

    return {
      ...fields,
      photo: photo
        ? { storageKey: photo.storageKey, contentType: photo.contentType }
        : null,
      idDocument: id
        ? { storageKey: id.storageKey, contentType: id.contentType }
        : null,
      submittedAt: profileSubmittedAt ? new Date(profileSubmittedAt) : null,
    };
  }

  async recordDocumentView(entry: DocumentViewEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO "AdminAuditLog"
         ("adminId", "action", "targetId", "requestId", "ipAddress", "userAgent", "createdAt")
       VALUES ($1, 'VIEW_DOCUMENT', $2, $3, $4, $5, $6)`,
      [
        entry.adminId,
        entry.targetId,
        entry.audit.requestId,
        entry.audit.ip,
        entry.audit.userAgent,
        entry.now,
      ],
    );
  }

  async applyDecision(
    input: DecisionInput,
    decide: (state: ReviewState) => ReviewTransition,
  ): Promise<DecisionOutcome> {
    return this.db.transaction(async (client): Promise<DecisionOutcome> => {
      const user = await client.query(
        `SELECT "accountStatus", "profileReviewStatus" FROM "Users"
         WHERE "id" = $1 AND "role" = 'user' FOR UPDATE`,
        [input.userId],
      );

      if (!user.rows[0]) {
        return { kind: 'notFound' };
      }

      const kyc = await client.query(
        `SELECT "id", "status" FROM "KycVerifications"
         WHERE "userId" = $1 FOR UPDATE`,
        [input.userId],
      );
      const purposes = kyc.rows[0]
        ? await client.query(
            `SELECT DISTINCT "purpose" FROM "KycMedia"
             WHERE "verificationId" = $1 AND "attachedAt" IS NOT NULL`,
            [kyc.rows[0].id],
          )
        : { rows: [] };
      const attached = purposes.rows.map((row) => row.purpose as string);
      const kycStatus: string | null = kyc.rows[0]?.status ?? null;

      // Throws INVALID_STATUS_TRANSITION; the transaction rolls back untouched.
      const transition = decide({
        accountStatus: user.rows[0].accountStatus,
        profileReviewStatus: user.rows[0].profileReviewStatus,
        kycStatus,
        hasPhoto: attached.includes('kycPhoto'),
        hasIdDocument: attached.includes('kycId'),
      });

      // The one writer of the status columns, with the values the domain chose.
      await client.query(
        'CALL sp_set_profile_review_status($1, $2, $3, $4, $5)',
        [
          input.userId,
          transition.profileReviewStatus,
          transition.accountStatus,
          input.now,
          null,
        ],
      );
      await this.callDecisionProcedure(client, input);

      return {
        kind: 'decided',
        statusBefore: kycStatus ?? 'notStarted',
        statusAfter: transition.kycStatus,
      };
    });
  }

  private async callDecisionProcedure(
    client: { query(sql: string, params?: any[]): Promise<{ rows: any[] }> },
    input: DecisionInput,
  ): Promise<void> {
    const { audit } = input;
    const common = [input.userId, input.adminId, input.reasonCode, input.notes];
    const trail = [audit.requestId, audit.ip, audit.userAgent];

    if (input.decision === 'requestChanges') {
      await client.query(
        'CALL sp_admin_request_changes($1, $2, $3, $4, $5::text[], $6, $7, $8)',
        [...common, input.sections, ...trail],
      );
      return;
    }

    await client.query(
      `CALL ${PROCEDURE_BY_DECISION[input.decision]}($1, $2, $3, $4, $5, $6, $7)`,
      [...common, ...trail],
    );
  }
}
