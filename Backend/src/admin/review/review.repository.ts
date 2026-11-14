import type {
  AuditContext,
  DecisionInput,
  DecisionOutcome,
  QueueRow,
  ReviewSubject,
  ReviewTransition,
} from './review.types';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');
export const REVIEW_CLOCK = Symbol('REVIEW_CLOCK');

export interface DocumentViewEntry {
  adminId: string;
  targetId: string;
  audit: AuditContext;
  now: Date;
}

/** The member state a decision is made against, read under the row lock. */
export interface ReviewState {
  accountStatus: string;
  kycStatus: string | null;
  hasPhoto: boolean;
  hasIdDocument: boolean;
}

/**
 * Persistence port for manual KYC review. `applyDecision` locks the member row,
 * calls `decide` with the locked state and, when it returns, applies the status
 * change and writes the one audit row in the same transaction. When `decide`
 * throws, nothing is written.
 */
export interface ReviewRepository {
  /** Members whose photo and ID are both attached and whose case needs review. */
  listAwaitingReview(): Promise<QueueRow[]>;
  findSubject(userId: string): Promise<ReviewSubject | null>;
  recordDocumentView(entry: DocumentViewEntry): Promise<void>;
  applyDecision(
    input: DecisionInput,
    decide: (state: ReviewState) => ReviewTransition,
  ): Promise<DecisionOutcome>;
}
