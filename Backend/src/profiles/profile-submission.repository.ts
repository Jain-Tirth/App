import type { KycStatus } from '../kyc/kyc.types';
import type {
  ProfileAccountStatus,
  ProfileReviewStatus,
} from './profile-status';
import type { SubmissionFacts } from './submission';

export const PROFILE_SUBMISSION_REPOSITORY = Symbol(
  'PROFILE_SUBMISSION_REPOSITORY',
);
export const PROFILE_STATUS_READER = Symbol('PROFILE_STATUS_READER');

/** A member's review state, read under the row lock. */
export interface SubmissionState {
  accountStatus: ProfileAccountStatus;
  profileReviewStatus: ProfileReviewStatus;
  submittedAt: Date | null;
  facts: SubmissionFacts;
}

/** What a submit or withdraw does to the member. */
export interface SubmissionChange {
  profileReviewStatus: ProfileReviewStatus;
  accountStatus: ProfileAccountStatus;
  /** Becomes the SLA start when the new status is `submitted`; ignored otherwise. */
  submittedAt: Date;
  /** The KYC case status chosen by the KYC domain, or null to leave it alone. */
  kycStatus: KycStatus | null;
}

export type SubmissionDecision =
  | { kind: 'unchanged' }
  | { kind: 'change'; change: SubmissionChange };

export interface SubmissionResult {
  profileReviewStatus: ProfileReviewStatus;
  submittedAt: Date | null;
}

export type SubmissionOutcome =
  | { kind: 'notFound' }
  | { kind: 'done'; result: SubmissionResult };

/**
 * Persistence port for member submission. `mutate` locks the member row, calls
 * `decide` with the locked state and applies the change it returns (or none).
 * When `decide` throws, nothing is written.
 */
export interface ProfileSubmissionRepository {
  mutate(
    userId: string,
    decide: (state: SubmissionState) => SubmissionDecision,
  ): Promise<SubmissionOutcome>;
}

/** Read-only port for the status guards. */
export interface ProfileStatusReader {
  findReviewStatus(userId: string): Promise<ProfileReviewStatus | null>;
}
