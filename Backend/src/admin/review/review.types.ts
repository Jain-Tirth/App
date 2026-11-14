import type { KycStatus } from '../../kyc/kyc.types';

export const REVIEW_REASON_CODES = [
  'unreadable-document',
  'expired-document',
  'name-mismatch',
  'photo-mismatch',
  'under-age',
  'prohibited-content',
  'incomplete-profile',
  'duplicate-account',
  'suspicious-activity',
  'terms-violation',
  'other',
] as const;
export type ReviewReasonCode = (typeof REVIEW_REASON_CODES)[number];

export const REVIEW_SECTIONS = [
  'step-1',
  'step-2',
  'step-3',
  'step-4',
  'step-5',
] as const;
export type ReviewSection = (typeof REVIEW_SECTIONS)[number];

export const REVIEW_NOTES_MAX = 500;

export type ReviewDecision = 'approve' | 'reject' | 'requestChanges';

export type SlaState = 'ok' | 'atRisk' | 'overdue';

/** Business-hours definition behind the SLA clock (env module, `env.review`). */
export interface BusinessHoursConfig {
  slaHours: number;
  /** ISO weekdays, Monday = 1 ... Sunday = 7. */
  days: readonly number[];
  startMinute: number;
  endMinute: number;
  timeZone: string;
}

export interface QueueRow {
  userId: string;
  profileUid: string | null;
  name: string;
  submittedAt: Date;
}

export interface QueueItem {
  userId: string;
  profileUid: string | null;
  name: string;
  submittedAt: string;
  slaRemainingHours: number;
  slaState: SlaState;
}

/** What the repository knows about one member's submission. */
export interface ReviewSubject {
  userId: string;
  profileUid: string | null;
  name: string;
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  accountStatus: string;
  kycStatus: string | null;
  documentType: string | null;
  idNumberLast4: string | null;
  photo: { storageKey: string; contentType: string } | null;
  idDocument: { storageKey: string; contentType: string } | null;
  submittedAt: Date | null;
}

export interface AuditContext {
  requestId: string;
  ip: string;
  userAgent: string;
}

export interface DecisionInput {
  userId: string;
  adminId: string;
  decision: ReviewDecision;
  reasonCode: ReviewReasonCode | null;
  notes: string | null;
  sections: ReviewSection[];
  audit: AuditContext;
  now: Date;
}

/** What a decision does to the member, chosen by the domain under the row lock. */
export interface ReviewTransition {
  kycStatus: KycStatus;
  accountStatus: 'active' | 'rejected' | 'pending';
}

export type DecisionOutcome =
  | { kind: 'notFound' }
  | { kind: 'decided'; statusBefore: string; statusAfter: string };
