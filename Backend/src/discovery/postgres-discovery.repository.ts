import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  buildDetailQuery,
  buildRecommendationInsert,
  buildRecommendationRead,
  buildSearchQuery,
} from './discovery-queries';
import type {
  AgeMinimums,
  DiscoveryCard,
  DiscoveryRepository,
  ProfileDetail,
  SearchCriteria,
  SearchRow,
  VisibleProfile,
} from './discovery.types';

@Injectable()
export class PostgresDiscoveryRepository implements DiscoveryRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: Pick<DatabaseService, 'query' | 'transaction'>,
  ) {}

  async search(criteria: SearchCriteria): Promise<SearchRow[]> {
    const query = buildSearchQuery(criteria);
    const result = await this.db.query<SearchRow>(query.text, query.values);

    return result.rows;
  }

  async dailyRecommendations(
    callerId: string,
    ageMinimums: AgeMinimums,
    count: number,
  ): Promise<DiscoveryCard[]> {
    // The advisory lock serialises concurrent first calls for one member so the
    // day's set is chosen exactly once.
    return this.db.transaction(async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))',
        [`daily-recommendations:${callerId}`],
      );

      const insert = buildRecommendationInsert(callerId, ageMinimums, count);
      await client.query(insert.text, insert.values);

      const read = buildRecommendationRead(callerId, ageMinimums);
      const result = await client.query(read.text, read.values);

      return result.rows as DiscoveryCard[];
    });
  }

  async findVisibleProfile(
    callerId: string,
    ageMinimums: AgeMinimums,
    profileRef: string,
  ): Promise<VisibleProfile | null> {
    const query = buildDetailQuery(callerId, ageMinimums, profileRef);
    const result = await this.db.query<
      ProfileDetail & { viewedUserId: string }
    >(query.text, query.values);
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const { viewedUserId, ...detail } = row;

    return { viewedUserId, detail };
  }

  async recordView(viewerId: string, viewedId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO "ProfileViews" ("viewerId", "viewedId")
       VALUES ($1, $2)
       ON CONFLICT ("viewerId", "viewedId", "viewedOn") DO NOTHING`,
      [viewerId, viewedId],
    );
  }
}
