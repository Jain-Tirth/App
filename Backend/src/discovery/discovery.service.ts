import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { SearchQueryDto } from './dto/search-query.dto';
import { MAX_PAGE_SIZE } from './dto/search-query.dto';
import { profileNotFound } from './discovery.errors';
import {
  DISCOVERY_AGE_MINIMUMS,
  DISCOVERY_DAILY_COUNT,
  DISCOVERY_REPOSITORY,
  SEARCH_FILTER_NAMES,
  type AgeMinimums,
  type DiscoveryCard,
  type DiscoveryRepository,
  type ProfileDetail,
  type SearchFilters,
} from './discovery.types';
import { decodeCursor, encodeCursor } from './search-cursor';

export const DEFAULT_PAGE_SIZE = 20;

export interface SearchPage {
  items: DiscoveryCard[];
  nextCursor: string | null;
}

@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(DISCOVERY_REPOSITORY)
    private readonly repository: DiscoveryRepository,
    @Inject(DISCOVERY_AGE_MINIMUMS)
    private readonly ageMinimums: AgeMinimums,
    @Inject(DISCOVERY_DAILY_COUNT) private readonly dailyCount: number,
  ) {}

  async search(user: AuthenticatedUser, query: SearchQueryDto): Promise<SearchPage> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const filters: SearchFilters = {};

    for (const name of SEARCH_FILTER_NAMES) {
      const value = query[name];

      if (value !== undefined) {
        filters[name] = value;
      }
    }

    const rows = await this.repository.search({
      callerId: user.sub,
      ageMinimums: this.ageMinimums,
      filters,
      after,
      fetch: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const items = page.map(({ createdAt: _createdAt, ...card }) => card);

    return {
      items,
      nextCursor:
        rows.length > limit
          ? encodeCursor({ createdAt: last.createdAt, profileRef: last.profileRef })
          : null,
    };
  }

  dailyRecommendations(user: AuthenticatedUser): Promise<DiscoveryCard[]> {
    return this.repository.dailyRecommendations(
      user.sub,
      this.ageMinimums,
      this.dailyCount,
    );
  }

  /** The list the legacy `GET /profiles/matches` route now serves. */
  async matches(user: AuthenticatedUser) {
    const page = await this.search(user, { limit: MAX_PAGE_SIZE });

    return { total: page.items.length, matches: page.items };
  }

  async getProfile(
    user: AuthenticatedUser,
    profileRef: string,
  ): Promise<ProfileDetail> {
    const visible = await this.repository.findVisibleProfile(
      user.sub,
      this.ageMinimums,
      profileRef,
    );

    if (!visible) {
      throw profileNotFound();
    }

    await this.repository.recordView(user.sub, visible.viewedUserId);

    return visible.detail;
  }
}
