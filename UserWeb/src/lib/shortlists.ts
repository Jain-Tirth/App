import type { DiscoveryCard, Shortlist } from '../types';
import { SHORTLIST_NAME_REQUIRED_MESSAGE, SHORTLIST_NAME_TOO_LONG_MESSAGE } from '../errors/messages';

export const LIST_NAME_MAX = 100;

export type ListNameCheck = { ok: true; name: string } | { ok: false; message: string };

/** Trims the input and applies the 1 to 100 character rule before any request is sent. */
export function validateListName(raw: string): ListNameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, message: SHORTLIST_NAME_REQUIRED_MESSAGE };
  if (name.length > LIST_NAME_MAX) return { ok: false, message: SHORTLIST_NAME_TOO_LONG_MESSAGE };
  return { ok: true, name };
}

/** Default list first, then the rest by creation time, oldest first. Does not mutate the input. */
export function orderLists(lists: readonly Shortlist[]): Shortlist[] {
  return [...lists].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
}

/** Appends a page of cards to the shown cards, keyed by profileRef, skipping any already shown. */
export function mergeCardPage(existing: DiscoveryCard[], incoming: DiscoveryCard[]): DiscoveryCard[] {
  const seen = new Set(existing.map((card) => card.profileRef));
  const merged = [...existing];
  for (const card of incoming) {
    if (seen.has(card.profileRef)) continue;
    seen.add(card.profileRef);
    merged.push(card);
  }
  return merged;
}

/** Which lists hold a profile: list id to the profileRefs known to be in it. */
export type MembershipMap = Record<string, readonly string[]>;

/** Adds the refs of a fetched page of cards to what is already known for one list. */
export function mergeMembership(
  existing: MembershipMap,
  listId: string,
  cards: readonly DiscoveryCard[],
): MembershipMap {
  const known = new Set(existing[listId] ?? []);
  for (const card of cards) known.add(card.profileRef);
  return { ...existing, [listId]: [...known] };
}

/** Records one confirmed add or remove. */
export function setMembership(
  existing: MembershipMap,
  listId: string,
  profileRef: string,
  present: boolean,
): MembershipMap {
  const known = new Set(existing[listId] ?? []);
  if (present) known.add(profileRef);
  else known.delete(profileRef);
  return { ...existing, [listId]: [...known] };
}

export function isMember(map: MembershipMap, listId: string, profileRef: string): boolean {
  return (map[listId] ?? []).includes(profileRef);
}
