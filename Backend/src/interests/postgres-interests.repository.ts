import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CARD_COLUMNS, CARD_JOINS } from '../discovery/discovery-queries';
import type { DiscoveryCard } from '../discovery/discovery.types';
import type {
  ClearCooldownInput,
  InterestListCriteria,
  InterestListRow,
  InterestRecord,
  InterestRepository,
  InterestStatus,
  SendContext,
  SendOutcome,
  TransitionDecision,
  TransitionOutcome,
} from './interest.types';

const RECORD_COLUMNS = `"id", "status"::text AS "status", "createdAt", "respondedAt"`;

type Db = Pick<DatabaseService, 'query' | 'transaction'>;
type Client = {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
};

function toRecord(row: any): InterestRecord {
  return {
    id: row.id,
    status: row.status as InterestStatus,
    createdAt: new Date(row.createdAt),
    respondedAt: row.respondedAt ? new Date(row.respondedAt) : null,
  };
}

async function writeEvent(
  client: Client,
  interestId: string,
  actorId: string,
  from: InterestStatus | null,
  to: InterestStatus,
  at: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO "InterestEvents"
       ("interestId", "actorId", "fromStatus", "toStatus", "createdAt")
     VALUES ($1, $2, $3, $4, $5)`,
    [interestId, actorId, from, to, at],
  );
}

@Injectable()
export class PostgresInterestsRepository implements InterestRepository {
  constructor(@Inject(DatabaseService) private readonly db: Db) {}

  async findUserIdByProfileRef(profileRef: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT "userId" FROM "Profiles" WHERE "profileRef" = $1`,
      [profileRef],
    );

    return result.rows[0]?.userId ?? null;
  }

  async send(
    input: { senderId: string; receiverId: string; now: Date },
    guard: (context: SendContext) => void,
  ): Promise<SendOutcome> {
    return this.db.transaction(async (client): Promise<SendOutcome> => {
      const declined = await client.query(
        `SELECT max("respondedAt") AS "at" FROM "Interests"
         WHERE "senderId" = $1 AND "receiverId" = $2
           AND "status" = 'declined' AND "cooldownClearedAt" IS NULL`,
        [input.senderId, input.receiverId],
      );
      const today = await client.query(
        `SELECT count(*)::int AS "n" FROM "Interests"
         WHERE "senderId" = $1
           AND "createdAt" >= (date_trunc('day', $2::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,
        [input.senderId, input.now],
      );

      guard({
        lastDeclinedAt: declined.rows[0]?.at ? new Date(declined.rows[0].at) : null,
        sentToday: today.rows[0].n,
      });

      // The partial unique index is the real duplicate guard; concurrent
      // identical sends leave exactly one row.
      const inserted = await client.query(
        `INSERT INTO "Interests" ("senderId", "receiverId", "status", "createdAt")
         VALUES ($1, $2, 'pending', $3)
         ON CONFLICT ("senderId", "receiverId")
           WHERE "status" IN ('pending', 'accepted') DO NOTHING
         RETURNING ${RECORD_COLUMNS}`,
        [input.senderId, input.receiverId, input.now],
      );

      if (!inserted.rows[0]) {
        return { kind: 'exists' };
      }

      const interest = toRecord(inserted.rows[0]);

      await writeEvent(client, interest.id, input.senderId, null, 'pending', input.now);

      return { kind: 'created', interest };
    });
  }

  async transition(
    request: {
      interestId: string;
      actorId: string;
      action: 'accept' | 'decline' | 'withdraw';
      now: Date;
    },
    decide: (from: InterestStatus) => TransitionDecision,
  ): Promise<TransitionOutcome> {
    return this.db.transaction(async (client): Promise<TransitionOutcome> => {
      // Ownership is part of the lookup, so another member's interest is
      // indistinguishable from an unknown one.
      const ownerColumn = request.action === 'withdraw' ? 'senderId' : 'receiverId';
      const found = await client.query(
        `SELECT ${RECORD_COLUMNS} FROM "Interests"
         WHERE "id" = $1 AND "${ownerColumn}" = $2 FOR UPDATE`,
        [request.interestId, request.actorId],
      );

      if (!found.rows[0]) {
        return { kind: 'notFound' };
      }

      const current = toRecord(found.rows[0]);
      const decision = decide(current.status);

      if (!decision.changed) {
        return { kind: 'done', interest: current };
      }

      const respondedAt = request.action === 'withdraw' ? current.respondedAt : request.now;
      const updated = await client.query(
        `UPDATE "Interests" SET "status" = $2::"InterestStatus", "respondedAt" = $3
         WHERE "id" = $1 RETURNING ${RECORD_COLUMNS}`,
        [current.id, decision.to, respondedAt],
      );

      await writeEvent(
        client,
        current.id,
        request.actorId,
        current.status,
        decision.to,
        request.now,
      );

      return { kind: 'done', interest: toRecord(updated.rows[0]) };
    });
  }

  async list(criteria: InterestListCriteria): Promise<InterestListRow[]> {
    const own = criteria.direction === 'sent' ? 'senderId' : 'receiverId';
    const other = criteria.direction === 'sent' ? 'receiverId' : 'senderId';
    const values: unknown[] = [criteria.userId];
    const conditions = [
      `i."${own}" = $1`,
      `u."role" = 'user'`,
      `u."profileReviewStatus" = 'approved'`,
      `u."accountStatus" = 'active'`,
    ];

    if (criteria.status) {
      values.push(criteria.status);
      conditions.push(`i."status" = $${values.length}::"InterestStatus"`);
    }

    if (criteria.after) {
      values.push(criteria.after.createdAt, criteria.after.id);
      conditions.push(
        `(i."createdAt", i."id") < ` +
          `($${values.length - 1}::timestamp AT TIME ZONE 'UTC', $${values.length}::uuid)`,
      );
    }

    values.push(criteria.fetch);

    const result = await this.db.query(
      `SELECT i."id" AS "interestId", i."status"::text AS "interestStatus",
              i."createdAt" AS "sentAt", i."respondedAt" AS "answeredAt",
              to_char(i."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS "cursorAt",
              ${CARD_COLUMNS}
       FROM "Interests" i
         JOIN "Users" u ON u."id" = i."${other}"
         JOIN "Profiles" p ON p."userId" = u."id"
         JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"
         ${CARD_JOINS}
       WHERE ${conditions.join('\n         AND ')}
       ORDER BY i."createdAt" DESC, i."id" DESC
       LIMIT $${values.length}`,
      values,
    );

    return result.rows.map((row) => {
      const {
        interestId,
        interestStatus,
        sentAt,
        answeredAt,
        cursorAt,
        ...member
      } = row;

      return {
        id: interestId,
        status: interestStatus as InterestStatus,
        createdAt: new Date(sentAt),
        respondedAt: answeredAt ? new Date(answeredAt) : null,
        cursorAt,
        member: member as DiscoveryCard,
      };
    });
  }

  async clearCooldown(input: ClearCooldownInput): Promise<boolean> {
    return this.db.transaction(async (client) => {
      const sender = await client.query(
        `SELECT "userId" FROM "Profiles" WHERE "profileUid" = $1`,
        [input.senderProfileUid],
      );
      const receiver = await client.query(
        `SELECT "userId" FROM "Profiles" WHERE "profileRef" = $1`,
        [input.receiverProfileRef],
      );

      if (!sender.rows[0] || !receiver.rows[0]) {
        return false;
      }

      const senderId: string = sender.rows[0].userId;
      const receiverId: string = receiver.rows[0].userId;
      const cleared = await client.query(
        `UPDATE "Interests" SET "cooldownClearedAt" = $3
         WHERE "senderId" = $1 AND "receiverId" = $2
           AND "status" = 'declined' AND "cooldownClearedAt" IS NULL
           AND "respondedAt" + ($4::int * INTERVAL '1 day') > $3::timestamptz
         RETURNING "id"`,
        [senderId, receiverId, input.now, input.cooldownDays],
      );

      if (cleared.rows.length === 0) {
        return false;
      }

      await client.query(
        `INSERT INTO "AdminAuditLog"
           ("adminId", "action", "targetId", "relatedId", "notes", "reasonCode",
            "requestId", "ipAddress", "userAgent", "createdAt")
         VALUES ($1, 'interestCooldownClear', $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          input.adminId,
          senderId,
          receiverId,
          input.notes,
          input.reasonCode,
          input.audit.requestId,
          input.audit.ip,
          input.audit.userAgent,
          input.now,
        ],
      );

      return true;
    });
  }
}
