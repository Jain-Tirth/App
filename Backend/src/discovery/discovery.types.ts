import type { SearchPosition } from './search-cursor';

export const SEARCH_FILTER_NAMES = [
  'maritalStatus',
  'religion',
  'community',
  'state',
  'city',
  'diet',
] as const;

export type SearchFilterName = (typeof SEARCH_FILTER_NAMES)[number];

export type SearchFilters = Partial<Record<SearchFilterName, string>>;

/** Sort orders a client may ask for. Only newest-first is offered. */
export const SEARCH_SORTS = ['newest'] as const;

export interface AgeMinimums {
  male: number;
  female: number;
}

/** What a member sees in a result list. Nothing here identifies the account. */
export interface DiscoveryCard {
  profileRef: string;
  firstName: string;
  age: number;
  city: string | null;
  religion: string | null;
  community: string | null;
  profession: string | null;
  photoRef: string | null;
  verified: boolean;
}

export interface ProfileDetail extends DiscoveryCard {
  heightCm: number | null;
  maritalStatus: string | null;
  diet: string | null;
  spokenLanguages: string[];
  subcommunity: string | null;
  state: string | null;
  country: string | null;
  education: string | null;
  employmentType: string | null;
  familyStatus: string | null;
  aboutMyself: string | null;
  lookingFor: string | null;
}

export interface SearchCriteria {
  callerId: string;
  ageMinimums: AgeMinimums;
  filters: SearchFilters;
  after: SearchPosition | null;
  /** Rows to fetch: one more than the page size, to learn whether a next page exists. */
  fetch: number;
}

export interface SearchRow extends DiscoveryCard {
  createdAt: string;
}

export interface VisibleProfile {
  viewedUserId: string;
  detail: ProfileDetail;
}

/**
 * Persistence port for discovery. Every implementation applies the hard
 * filters itself (self, hidden, not approved, blocked, same gender, under the
 * age gate); callers never filter results afterwards.
 */
export interface DiscoveryRepository {
  search(criteria: SearchCriteria): Promise<SearchRow[]>;
  dailyRecommendations(
    callerId: string,
    ageMinimums: AgeMinimums,
    count: number,
  ): Promise<DiscoveryCard[]>;
  findVisibleProfile(
    callerId: string,
    ageMinimums: AgeMinimums,
    profileRef: string,
  ): Promise<VisibleProfile | null>;
  recordView(viewerId: string, viewedId: string): Promise<void>;
}

export const DISCOVERY_REPOSITORY = Symbol('DISCOVERY_REPOSITORY');
export const DISCOVERY_AGE_MINIMUMS = Symbol('DISCOVERY_AGE_MINIMUMS');
export const DISCOVERY_DAILY_COUNT = Symbol('DISCOVERY_DAILY_COUNT');
