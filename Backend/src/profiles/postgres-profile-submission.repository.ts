import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
  ProfileAccountStatus,
  ProfileReviewStatus,
} from './profile-status';
import type {
  ProfileStatusReader,
  ProfileSubmissionRepository,
  SubmissionDecision,
  SubmissionOutcome,
  SubmissionState,
} from './profile-submission.repository';

interface MemberRow {
  accountStatus: ProfileAccountStatus;
  profileReviewStatus: ProfileReviewStatus;
  profileSubmittedAt: Date | string | null;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  step1: boolean;
  step2: boolean;
  step3: boolean;
  step4: boolean;
  step5: boolean;
}

@Injectable()
export class PostgresProfileSubmissionRepository
  implements ProfileSubmissionRepository, ProfileStatusReader
{
  constructor(private readonly db: DatabaseService) {}

  async findReviewStatus(userId: string): Promise<ProfileReviewStatus | null> {
    const result = await this.db.query<{ profileReviewStatus: ProfileReviewStatus }>(
      'SELECT "profileReviewStatus" FROM "Users" WHERE "id" = $1',
      [userId],
    );

    return result.rows[0]?.profileReviewStatus ?? null;
  }

  async mutate(
    userId: string,
    decide: (state: SubmissionState) => SubmissionDecision,
  ): Promise<SubmissionOutcome> {
    return this.db.transaction(async (client): Promise<SubmissionOutcome> => {
      const member = await client.query(
        `SELECT u."accountStatus", u."profileReviewStatus", u."profileSubmittedAt",
                u."gender", to_char(pp."dateOfBirth", 'YYYY-MM-DD') AS "dateOfBirth",
                (pp."profileId" IS NOT NULL) AS "step1",
                (pr."profileId" IS NOT NULL) AS "step2",
                (pl."profileId" IS NOT NULL) AS "step3",
                (pw."profileId" IS NOT NULL) AS "step4",
                (pf."profileId" IS NOT NULL) AS "step5"
         FROM "Users" u
         LEFT JOIN "Profiles" p ON p."userId" = u."id"
         LEFT JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"
         LEFT JOIN "ProfileReligious" pr ON pr."profileId" = p."id"
         LEFT JOIN "ProfileLocations" pl ON pl."profileId" = p."id"
         LEFT JOIN "ProfileProfessional" pw ON pw."profileId" = p."id"
         LEFT JOIN "ProfileFamilyBio" pf ON pf."profileId" = p."id"
         WHERE u."id" = $1 AND u."role" = 'user'
         FOR UPDATE OF u`,
        [userId],
      );
      const row: MemberRow | undefined = member.rows[0];

      if (!row) {
        return { kind: 'notFound' };
      }

      const kyc = await client.query(
        `SELECT "id", "status" FROM "KycVerifications"
         WHERE "userId" = $1 FOR UPDATE`,
        [userId],
      );
      const purposes = kyc.rows[0]
        ? await client.query(
            `SELECT DISTINCT "purpose" FROM "KycMedia"
             WHERE "verificationId" = $1 AND "attachedAt" IS NOT NULL`,
            [kyc.rows[0].id],
          )
        : { rows: [] };
      const attached = purposes.rows.map((item) => item.purpose as string);
      const submittedAt = row.profileSubmittedAt
        ? new Date(row.profileSubmittedAt)
        : null;

      const decision = decide({
        accountStatus: row.accountStatus,
        profileReviewStatus: row.profileReviewStatus,
        submittedAt,
        facts: {
          completedSteps: [
            row.step1 && 'step-1',
            row.step2 && 'step-2',
            row.step3 && 'step-3',
            row.step4 && 'step-4',
            row.step5 && 'step-5',
          ].filter((step): step is string => typeof step === 'string'),
          gender: row.gender,
          dateOfBirth: row.dateOfBirth,
          kycStatus: kyc.rows[0]?.status ?? null,
          hasPhoto: attached.includes('kycPhoto'),
          hasIdDocument: attached.includes('kycId'),
        },
      });

      if (decision.kind === 'unchanged') {
        return {
          kind: 'done',
          result: { profileReviewStatus: row.profileReviewStatus, submittedAt },
        };
      }

      const { change } = decision;

      await client.query(
        'CALL sp_set_profile_review_status($1, $2, $3, $4, $5)',
        [
          userId,
          change.profileReviewStatus,
          change.accountStatus,
          change.submittedAt,
          change.kycStatus,
        ],
      );

      return {
        kind: 'done',
        result: {
          profileReviewStatus: change.profileReviewStatus,
          submittedAt:
            change.profileReviewStatus === 'submitted'
              ? change.submittedAt
              : change.profileReviewStatus === 'draft'
                ? null
                : submittedAt,
        },
      };
    });
  }
}
