import type { AgeMinimums, DiscoveryCard } from '../discovery/discovery.types';

export const DEFAULT_SHORTLIST_NAME = 'Shortlisted';
export const SHORTLIST_NAME_MAX = 100;
export const DEFAULT_SHORTLIST_PAGE_SIZE = 20;
export const MAX_SHORTLIST_PAGE_SIZE = 50;

export interface ShortlistRecord {
  id: string;
  name: string;
  isDefault: boolean;
  profileCount: number;
  createdAt: Date;
}

export interface ShortlistPosition {
  createdAt: string;
  id: string;
}

export interface ShortlistProfileRow {
  member: DiscoveryCard;
  /** Keyset position text (UTC, microseconds) and the member's user id. */
  cursorAt: string;
  cursorId: string;
}

export interface ShortlistProfileCriteria {
  userId: string;
  listId: string;
  ageMinimums: AgeMinimums;
  after: ShortlistPosition | null;
  fetch: number;
}

export interface AddProfileContext {
  distinctProfiles: number;
  alreadyShortlisted: boolean;
}

export type CreateOutcome =
  | { kind: 'created'; list: ShortlistRecord }
  | { kind: 'nameTaken' };

export type RenameOutcome =
  | { kind: 'done'; list: ShortlistRecord }
  | { kind: 'notFound' }
  | { kind: 'protected' }
  | { kind: 'nameTaken' };

export type DeleteOutcome = { kind: 'done' } | { kind: 'notFound' } | { kind: 'protected' };

/** Persistence port for shortlists. Every method is scoped to the owner. */
export interface ShortlistRepository {
  findUserIdByProfileRef(profileRef: string): Promise<string | null>;
  /** Creates the default list on first use, then returns all lists. */
  listLists(userId: string): Promise<ShortlistRecord[]>;
  createList(
    input: { userId: string; name: string },
    guard: (existingLists: number) => void,
  ): Promise<CreateOutcome>;
  renameList(input: { userId: string; listId: string; name: string }): Promise<RenameOutcome>;
  deleteList(input: { userId: string; listId: string }): Promise<DeleteOutcome>;
  /** True when the member owns the list. */
  ownsList(userId: string, listId: string): Promise<boolean>;
  /** Returns false when the member does not own the list. */
  addProfile(
    input: { userId: string; listId: string; targetId: string },
    guard: (context: AddProfileContext) => void,
  ): Promise<boolean>;
  /** Returns false when the member does not own the list. */
  removeProfile(input: { userId: string; listId: string; targetId: string }): Promise<boolean>;
  listProfiles(criteria: ShortlistProfileCriteria): Promise<ShortlistProfileRow[]>;
}

export interface ShortlistConfig {
  /** `null` means unlimited. */
  maxLists: number | null;
  maxProfiles: number | null;
}

export const SHORTLIST_REPOSITORY = Symbol('SHORTLIST_REPOSITORY');
export const SHORTLIST_CONFIG = Symbol('SHORTLIST_CONFIG');
export const SHORTLIST_AGE_MINIMUMS = Symbol('SHORTLIST_AGE_MINIMUMS');
