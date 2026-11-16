import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CARD_COLUMNS, CARD_JOINS, VISIBLE_WHERE } from '../discovery/discovery-queries';
import type { DiscoveryCard } from '../discovery/discovery.types';
import {
  DEFAULT_SHORTLIST_NAME,
  type AddProfileContext,
  type CreateOutcome,
  type DeleteOutcome,
  type RenameOutcome,
  type ShortlistProfileCriteria,
  type ShortlistProfileRow,
  type ShortlistRecord,
  type ShortlistRepository,
} from './shortlist.types';

type Db = Pick<DatabaseService, 'query' | 'transaction'>;
type Client = {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
};

const LIST_COLUMNS = `l."id", l."name", l."isDefault", l."createdAt",
  (SELECT count(*)::int FROM "ShortlistProfiles" sp WHERE sp."listId" = l."id") AS "profileCount"`;

function toRecord(row: any): ShortlistRecord {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    profileCount: row.profileCount,
    createdAt: new Date(row.createdAt),
  };
}

/** Serialises one member's shortlist writes so count-based guards are exact. */
async function lockMember(client: Client, userId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`shortlists:${userId}`]);
}

async function ensureDefault(client: Client, userId: string): Promise<void> {
  await client.query(
    `INSERT INTO "ShortlistLists" ("userId", "name", "isDefault")
     VALUES ($1, $2, true)
     ON CONFLICT ("userId") WHERE "isDefault" DO NOTHING`,
    [userId, DEFAULT_SHORTLIST_NAME],
  );
}

async function findList(client: Client, userId: string, listId: string): Promise<any | null> {
  const result = await client.query(
    `SELECT ${LIST_COLUMNS} FROM "ShortlistLists" l
     WHERE l."id" = $1 AND l."userId" = $2`,
    [listId, userId],
  );

  return result.rows[0] ?? null;
}

@Injectable()
export class PostgresShortlistsRepository implements ShortlistRepository {
  constructor(@Inject(DatabaseService) private readonly db: Db) {}

  async findUserIdByProfileRef(profileRef: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT "userId" FROM "Profiles" WHERE "profileRef" = $1`,
      [profileRef],
    );

    return result.rows[0]?.userId ?? null;
  }

  async listLists(userId: string): Promise<ShortlistRecord[]> {
    return this.db.transaction(async (client) => {
      await lockMember(client, userId);
      await ensureDefault(client, userId);

      const result = await client.query(
        `SELECT ${LIST_COLUMNS} FROM "ShortlistLists" l
         WHERE l."userId" = $1
         ORDER BY l."isDefault" DESC, l."createdAt", l."id"`,
        [userId],
      );

      return result.rows.map(toRecord);
    });
  }

  async createList(
    input: { userId: string; name: string },
    guard: (existingLists: number) => void,
  ): Promise<CreateOutcome> {
    return this.db.transaction(async (client): Promise<CreateOutcome> => {
      await lockMember(client, input.userId);
      await ensureDefault(client, input.userId);

      const count = await client.query(
        `SELECT count(*)::int AS "n" FROM "ShortlistLists" WHERE "userId" = $1`,
        [input.userId],
      );

      guard(count.rows[0].n);

      const inserted = await client.query(
        `INSERT INTO "ShortlistLists" ("userId", "name") VALUES ($1, $2)
         ON CONFLICT ("userId", lower("name")) DO NOTHING
         RETURNING "id"`,
        [input.userId, input.name],
      );

      if (!inserted.rows[0]) {
        return { kind: 'nameTaken' };
      }

      const row = await findList(client, input.userId, inserted.rows[0].id);

      return { kind: 'created', list: toRecord(row) };
    });
  }

  async renameList(input: {
    userId: string;
    listId: string;
    name: string;
  }): Promise<RenameOutcome> {
    return this.db.transaction(async (client): Promise<RenameOutcome> => {
      await lockMember(client, input.userId);

      const current = await findList(client, input.userId, input.listId);

      if (!current) {
        return { kind: 'notFound' };
      }

      if (current.isDefault) {
        return { kind: 'protected' };
      }

      const clash = await client.query(
        `SELECT 1 FROM "ShortlistLists"
         WHERE "userId" = $1 AND lower("name") = lower($2) AND "id" <> $3`,
        [input.userId, input.name, input.listId],
      );

      if (clash.rows[0]) {
        return { kind: 'nameTaken' };
      }

      await client.query(`UPDATE "ShortlistLists" SET "name" = $2 WHERE "id" = $1`, [
        input.listId,
        input.name,
      ]);

      return { kind: 'done', list: toRecord(await findList(client, input.userId, input.listId)) };
    });
  }

  async deleteList(input: { userId: string; listId: string }): Promise<DeleteOutcome> {
    return this.db.transaction(async (client): Promise<DeleteOutcome> => {
      await lockMember(client, input.userId);

      const current = await findList(client, input.userId, input.listId);

      if (!current) {
        return { kind: 'notFound' };
      }

      if (current.isDefault) {
        return { kind: 'protected' };
      }

      // Memberships go with the list (ON DELETE CASCADE); profiles and other
      // lists are untouched.
      await client.query(`DELETE FROM "ShortlistLists" WHERE "id" = $1`, [input.listId]);

      return { kind: 'done' };
    });
  }

  async ownsList(userId: string, listId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM "ShortlistLists" WHERE "id" = $1 AND "userId" = $2`,
      [listId, userId],
    );

    return result.rows.length > 0;
  }

  async addProfile(
    input: { userId: string; listId: string; targetId: string },
    guard: (context: AddProfileContext) => void,
  ): Promise<boolean> {
    return this.db.transaction(async (client) => {
      await lockMember(client, input.userId);

      if (!(await findList(client, input.userId, input.listId))) {
        return false;
      }

      const distinct = await client.query(
        `SELECT count(DISTINCT sp."targetId")::int AS "n",
                bool_or(sp."targetId" = $2) AS "already"
         FROM "ShortlistProfiles" sp
         JOIN "ShortlistLists" l ON l."id" = sp."listId"
         WHERE l."userId" = $1`,
        [input.userId, input.targetId],
      );

      guard({
        distinctProfiles: distinct.rows[0].n,
        alreadyShortlisted: distinct.rows[0].already === true,
      });

      await client.query(
        `INSERT INTO "ShortlistProfiles" ("listId", "targetId") VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [input.listId, input.targetId],
      );

      return true;
    });
  }

  async removeProfile(input: {
    userId: string;
    listId: string;
    targetId: string;
  }): Promise<boolean> {
    return this.db.transaction(async (client) => {
      if (!(await findList(client, input.userId, input.listId))) {
        return false;
      }

      await client.query(
        `DELETE FROM "ShortlistProfiles" WHERE "listId" = $1 AND "targetId" = $2`,
        [input.listId, input.targetId],
      );

      return true;
    });
  }

  async listProfiles(criteria: ShortlistProfileCriteria): Promise<ShortlistProfileRow[]> {
    const values: unknown[] = [
      criteria.userId,
      criteria.ageMinimums.male,
      criteria.ageMinimums.female,
      criteria.listId,
    ];
    const conditions = [VISIBLE_WHERE, `sp."listId" = $4`];

    if (criteria.after) {
      values.push(criteria.after.createdAt, criteria.after.id);
      conditions.push(
        `(sp."createdAt", sp."targetId") < ` +
          `($${values.length - 1}::timestamp AT TIME ZONE 'UTC', $${values.length}::uuid)`,
      );
    }

    values.push(criteria.fetch);

    // The visibility rule is story 6's, so a profile that stopped being
    // approved or visible drops out here without its membership being deleted.
    const result = await this.db.query(
      `SELECT ${CARD_COLUMNS},
              to_char(sp."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS "cursorAt",
              sp."targetId"::text AS "cursorId"
       FROM "ShortlistProfiles" sp
         JOIN "Users" u ON u."id" = sp."targetId"
         JOIN "Profiles" p ON p."userId" = u."id"
         JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"
         ${CARD_JOINS}
       WHERE ${conditions.join('\n         AND ')}
       ORDER BY sp."createdAt" DESC, sp."targetId" DESC
       LIMIT $${values.length}`,
      values,
    );

    return result.rows.map((row) => {
      const { cursorAt, cursorId, ...member } = row;

      return { member: member as DiscoveryCard, cursorAt, cursorId };
    });
  }
}
