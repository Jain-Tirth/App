import type { DiscoveryCard } from '../discovery/discovery.types';

/** `expired` is reserved in the database enum and never produced in Phase 1. */
export const INTEREST_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
] as const;
export type InterestStatus = (typeof INTEREST_STATUSES)[number];

export type InterestAction = 'accept' | 'decline' | 'withdraw';

export type InterestDirection = 'sent' | 'received';

export const MAX_INTEREST_PAGE_SIZE = 50;
export const DEFAULT_INTEREST_PAGE_SIZE = 20;

export interface InterestRecord {
  id: string;
  status: InterestStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface InterestListRow extends InterestRecord {
  member: DiscoveryCard;
  /** Keyset position text (UTC, microseconds); never sent to clients as is. */
  cursorAt: string;
}

export interface InterestPosition {
  createdAt: string;
  id: string;
}

export interface InterestListCriteria {
  userId: string;
  direction: InterestDirection;
  status: InterestStatus | null;
  after: InterestPosition | null;
  fetch: number;
}

export interface SendContext {
  lastDeclinedAt: Date | null;
  sentToday: number;
}

export type SendOutcome =
  | { kind: 'created'; interest: InterestRecord }
  | { kind: 'exists' };

export interface TransitionDecision {
  to: InterestStatus;
  /** False when the call repeats a terminal state it already reached. */
  changed: boolean;
}

export type TransitionOutcome =
  | { kind: 'notFound' }
  | { kind: 'done'; interest: InterestRecord };

export interface ClearCooldownInput {
  senderProfileUid: string;
  receiverProfileRef: string;
  adminId: string;
  reasonCode: string;
  notes: string | null;
  cooldownDays: number;
  audit: { requestId: string; ip: string; userAgent: string };
  now: Date;
}

/** Persistence port for interests. */
export interface InterestRepository {
  findUserIdByProfileRef(profileRef: string): Promise<string | null>;
  send(
    input: { senderId: string; receiverId: string; now: Date },
    guard: (context: SendContext) => void,
  ): Promise<SendOutcome>;
  transition(
    request: {
      interestId: string;
      actorId: string;
      action: InterestAction;
      now: Date;
    },
    decide: (from: InterestStatus) => TransitionDecision,
  ): Promise<TransitionOutcome>;
  list(criteria: InterestListCriteria): Promise<InterestListRow[]>;
  /** Returns false when no active cooldown exists for the pair. */
  clearCooldown(input: ClearCooldownInput): Promise<boolean>;
}

export interface InterestConfig {
  resendCooldownDays: number;
  /** `null` means unlimited. */
  dailySendLimit: number | null;
}

export const INTEREST_REPOSITORY = Symbol('INTEREST_REPOSITORY');
export const INTEREST_CLOCK = Symbol('INTEREST_CLOCK');
export const INTEREST_CONFIG = Symbol('INTEREST_CONFIG');
export const INTEREST_AGE_MINIMUMS = Symbol('INTEREST_AGE_MINIMUMS');
