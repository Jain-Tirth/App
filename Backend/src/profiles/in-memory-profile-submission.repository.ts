import type {
  ProfileStatusReader,
  ProfileSubmissionRepository,
  SubmissionDecision,
  SubmissionOutcome,
  SubmissionState,
} from './profile-submission.repository';
import type { ProfileReviewStatus } from './profile-status';

/**
 * Reference implementation of the submission port, for tests. A change applies
 * completely or, when `decide` throws, not at all.
 */
export class InMemoryProfileSubmissionRepository
  implements ProfileSubmissionRepository, ProfileStatusReader
{
  readonly members = new Map<string, SubmissionState>();

  addMember(userId: string, state: SubmissionState): void {
    this.members.set(userId, { ...state, facts: { ...state.facts } });
  }

  async findReviewStatus(userId: string): Promise<ProfileReviewStatus | null> {
    return this.members.get(userId)?.profileReviewStatus ?? null;
  }

  async mutate(
    userId: string,
    decide: (state: SubmissionState) => SubmissionDecision,
  ): Promise<SubmissionOutcome> {
    const member = this.members.get(userId);

    if (!member) {
      return { kind: 'notFound' };
    }

    const decision = decide(member);

    if (decision.kind === 'change') {
      const { change } = decision;

      member.profileReviewStatus = change.profileReviewStatus;
      member.accountStatus = change.accountStatus;

      if (change.profileReviewStatus === 'submitted') {
        member.submittedAt = change.submittedAt;
      } else if (change.profileReviewStatus === 'draft') {
        member.submittedAt = null;
      }

      if (change.kycStatus) {
        member.facts.kycStatus = change.kycStatus;
      }
    }

    return {
      kind: 'done',
      result: {
        profileReviewStatus: member.profileReviewStatus,
        submittedAt: member.submittedAt,
      },
    };
  }
}
