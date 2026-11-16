import { api } from '../api';
import { mergeMembership, setMembership, type MembershipMap } from './shortlists';

/**
 * Session cache of which profiles are in which list. The Backend returns no
 * per-profile membership field, so membership is derived by walking each list's
 * cards. The cache belongs to one access token and is dropped when it changes.
 */
let owner: string | null = null;
let known: MembershipMap = {};

function claim(token: string): void {
  if (owner !== token) {
    owner = token;
    known = {};
  }
}

export function hasList(token: string, listId: string): boolean {
  claim(token);
  return Object.prototype.hasOwnProperty.call(known, listId);
}

export function membershipSnapshot(token: string): MembershipMap {
  claim(token);
  return known;
}

/** Walks a list page by page (largest page size) and stores its profileRefs. */
export async function deriveList(token: string, listId: string): Promise<void> {
  claim(token);
  let map: MembershipMap = { [listId]: [] };
  let cursor: string | null = null;
  do {
    const page = await api.listShortlistProfiles(token, listId, { limit: 50, cursor });
    map = mergeMembership(map, listId, page.items);
    cursor = page.nextCursor;
  } while (cursor);
  claim(token);
  known = { ...known, [listId]: map[listId] };
}

export function noteMembership(token: string, listId: string, profileRef: string, present: boolean): void {
  claim(token);
  if (!Object.prototype.hasOwnProperty.call(known, listId)) return;
  known = setMembership(known, listId, profileRef, present);
}

export function noteEmptyList(token: string, listId: string): void {
  claim(token);
  known = { ...known, [listId]: [] };
}

/** Forgets lists that no longer exist. */
export function keepOnly(token: string, listIds: readonly string[]): void {
  claim(token);
  const keep = new Set(listIds);
  known = Object.fromEntries(Object.entries(known).filter(([id]) => keep.has(id)));
}

export function resetCache(): void {
  owner = null;
  known = {};
}
