import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error';
import { transitionKycStatus } from '../kyc/kyc.domain';
import type { AgeMinimums } from './age-gate';
import {
  transitionProfileStatus,
  type ProfileEvent,
  type ProfileReviewStatus,
} from './profile-status';
import {
  PROFILE_SUBMISSION_REPOSITORY,
  type ProfileSubmissionRepository,
  type SubmissionResult,
  type SubmissionState,
} from './profile-submission.repository';
import { findMissingForSubmission } from './submission';

export const SUBMISSION_CONSENT_GATE = Symbol('SUBMISSION_CONSENT_GATE');
export const SUBMISSION_CLOCK = Symbol('SUBMISSION_CLOCK');
export const SUBMISSION_AGE_MINIMUMS = Symbol('SUBMISSION_AGE_MINIMUMS');

/** What submission needs to know about consent (story 1). */
export interface SubmissionConsentGate {
  hasValidRequiredConsents(userId: string): Promise<boolean>;
}

export interface SubmissionView {
  status: ProfileReviewStatus;
  submittedAt: string | null;
}

@Injectable()
export class ProfileSubmissionService {
  constructor(
    @Inject(PROFILE_SUBMISSION_REPOSITORY)
    private readonly repository: ProfileSubmissionRepository,
    @Inject(SUBMISSION_CONSENT_GATE)
    private readonly consents: SubmissionConsentGate,
    @Inject(SUBMISSION_CLOCK) private readonly clock: () => Date,
    @Inject(SUBMISSION_AGE_MINIMUMS) private readonly minimums: AgeMinimums,
  ) {}

  /** Draft or needsChanges to submitted; a repeat call from submitted changes nothing. */
  async submit(userId: string): Promise<SubmissionView> {
    const consentValid = await this.consents.hasValidRequiredConsents(userId);
    const now = this.clock();

    const outcome = await this.repository.mutate(userId, (state) => {
      if (state.profileReviewStatus === 'submitted') {
        return { kind: 'unchanged' };
      }

      const next = this.transition(state, 'submit');
      const missing = findMissingForSubmission(state.facts, {
        consentValid,
        now,
        minimums: this.minimums,
      });

      if (missing.length > 0) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'SUBMISSION_INCOMPLETE',
          'The profile is missing required items.',
          { missing },
        );
      }

      return {
        kind: 'change',
        change: {
          ...next,
          submittedAt: now,
          kycStatus:
            state.facts.kycStatus === 'changesNeeded'
              ? transitionKycStatus('changesNeeded', 'resubmit')
              : null,
        },
      };
    });

    return this.view(outcome);
  }

  /** Submitted back to draft; the profile leaves the queue and the SLA clock clears. */
  async withdraw(userId: string): Promise<SubmissionView> {
    const now = this.clock();

    const outcome = await this.repository.mutate(userId, (state) => ({
      kind: 'change',
      change: {
        ...this.transition(state, 'withdraw'),
        submittedAt: now,
        kycStatus: null,
      },
    }));

    return this.view(outcome);
  }

  private transition(state: SubmissionState, event: ProfileEvent) {
    const next = transitionProfileStatus(
      state.profileReviewStatus,
      event,
      state.accountStatus,
    );

    if (!next.ok) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'INVALID_STATUS_TRANSITION',
        'This action is not allowed in the current profile status.',
        { status: state.profileReviewStatus, event },
      );
    }

    return {
      profileReviewStatus: next.status,
      accountStatus: next.accountStatus,
    };
  }

  private view(
    outcome: { kind: 'notFound' } | { kind: 'done'; result: SubmissionResult },
  ): SubmissionView {
    if (outcome.kind === 'notFound') {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
        'Member account not found.',
      );
    }

    return {
      status: outcome.result.profileReviewStatus,
      submittedAt: outcome.result.submittedAt?.toISOString() ?? null,
    };
  }
}
