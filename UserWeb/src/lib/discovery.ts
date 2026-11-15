/** The only filters the backend ships. There is no age, height or profile-ID search. */
export const FILTER_KEYS = ['maritalStatus', 'religion', 'community', 'state', 'city', 'diet'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type SearchFilters = Record<FilterKey, string>;

export const EMPTY_FILTERS: SearchFilters = {
  maritalStatus: '',
  religion: '',
  community: '',
  state: '',
  city: '',
  diet: '',
};

/** Same values as the wizard's step 1 selects. */
export const MARITAL_STATUS_OPTIONS = [
  { value: 'neverMarried', label: 'Never Married' },
  { value: 'widower', label: 'Widowed' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'awaitingDivorce', label: 'Awaiting Divorce' },
] as const;

export const DIET_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'nonVegetarian', label: 'Non-Vegetarian' },
  { value: 'eggetarian', label: 'Eggetarian' },
] as const;

const ENUM_VALUES: Partial<Record<FilterKey, readonly string[]>> = {
  maritalStatus: MARITAL_STATUS_OPTIONS.map((o) => o.value),
  diet: DIET_OPTIONS.map((o) => o.value),
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Builds the query string for GET /discovery/search. Only the shipping filters,
 * `cursor` and `limit` can appear; anything else passed in is dropped.
 */
export function buildSearchParams(input: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = clean(input[key]);
    if (value) params.set(key, value);
  }
  const cursor = clean(input.cursor);
  if (cursor) params.set('cursor', cursor);
  const limit = input.limit;
  if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
    params.set('limit', String(limit));
  }
  return params;
}

/** Reads the filters back from the page URL; values the server would reject are dropped. */
export function filtersFromQuery(query: URLSearchParams): SearchFilters {
  const filters: SearchFilters = { ...EMPTY_FILTERS };
  for (const key of FILTER_KEYS) {
    const value = clean(query.get(key));
    const allowed = ENUM_VALUES[key];
    if (value && (!allowed || allowed.includes(value))) filters[key] = value;
  }
  return filters;
}

/** Writes the active filters (non-empty only) for the page URL. */
export function filtersToQuery(filters: SearchFilters): URLSearchParams {
  return buildSearchParams(filters);
}

/** Appends a page to the list, keyed by profileRef, skipping anything already shown. */
export function mergePage<T extends { profileRef: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((item) => item.profileRef));
  const merged = [...existing];
  for (const item of incoming) {
    if (seen.has(item.profileRef)) continue;
    seen.add(item.profileRef);
    merged.push(item);
  }
  return merged;
}

export function formatAge(age: number | null | undefined): string {
  if (typeof age !== 'number' || !Number.isFinite(age) || age <= 0) return '';
  return `${age} ${age === 1 ? 'year' : 'years'}`;
}

export const NOT_SHARED = 'Not shared';

export function displayValue(value: string | null | undefined): string {
  return typeof value === 'string' && value.trim() ? value : NOT_SHARED;
}
