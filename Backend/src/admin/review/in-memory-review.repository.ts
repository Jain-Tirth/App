import type {
  DocumentViewEntry,
  ReviewRepository,
  ReviewState,
} from './review.repository';
import type {
  DecisionInput,
  DecisionOutcome,
  QueueRow,
  ReviewSubject,
  ReviewTransition,
} from './review.types';

export interface AuditRow {
  adminId: string;
  targetId: string;
  action: string;
  reasonCode: string | null;
  notes: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  requestId: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

export interface StoredDecision {
  decision: string;
  reasonCode: string | null;
  notes: string | null;
  sections: string[];
}

const ACTIONS = {
  approve: 'APPROVE_PROFILE',
  reject: 'REJECT_PROFILE',
  requestChanges: 'REQUEST_CHANGES',
  reopen: 'REOPEN_PROFILE',
} as const;

/**
 * Reference implementation of the review port, for tests. A decision either
 * applies completely (status and audit row) or, when `decide` throws, not at all.
 */
export class InMemoryReviewRepository implements ReviewRepository {
  readonly subjects: ReviewSubject[] = [];
  readonly auditLog: AuditRow[] = [];
  readonly decisions = new Map<string, StoredDecision>();

  addSubject(subject: ReviewSubject): void {
    this.subjects.push({ ...subject });
  }

  async listAwaitingReview(): Promise<QueueRow[]> {
    return this.subjects
      .filter(
        (item) =>
          item.accountStatus === 'pending' &&
          item.profileReviewStatus === 'submitted' &&
          item.photo &&
          item.idDocument &&
          item.submittedAt,
      )
      .map((item) => ({
        userId: item.userId,
        profileUid: item.profileUid,
        name: item.name,
        submittedAt: item.submittedAt as Date,
      }))
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  }

  async findSubject(userId: string): Promise<ReviewSubject | null> {
    const found = this.subjects.find((item) => item.userId === userId);

    return found ? { ...found } : null;
  }

  async recordDocumentView(entry: DocumentViewEntry): Promise<void> {
    this.auditLog.push({
      adminId: entry.adminId,
      targetId: entry.targetId,
      action: 'VIEW_DOCUMENT',
      reasonCode: null,
      notes: null,
      statusBefore: null,
      statusAfter: null,
      requestId: entry.audit.requestId,
      ip: entry.audit.ip,
      userAgent: entry.audit.userAgent,
      createdAt: entry.now,
    });
  }

  async applyDecision(
    input: DecisionInput,
    decide: (state: ReviewState) => ReviewTransition,
  ): Promise<DecisionOutcome> {
    const subject = this.subjects.find((item) => item.userId === input.userId);

    if (!subject) {
      return { kind: 'notFound' };
    }

    const transition = decide({
      accountStatus: subject.accountStatus,
      profileReviewStatus: subject.profileReviewStatus,
      kycStatus: subject.kycStatus,
      hasPhoto: subject.photo !== null,
      hasIdDocument: subject.idDocument !== null,
    });
    const statusBefore = subject.kycStatus ?? 'notStarted';

    subject.accountStatus = transition.accountStatus;
    subject.profileReviewStatus = transition.profileReviewStatus;
    subject.kycStatus = transition.kycStatus;
    this.decisions.set(input.userId, {
      decision: input.decision,
      reasonCode: input.reasonCode,
      notes: input.notes,
      sections: input.sections,
    });
    this.auditLog.push({
      adminId: input.adminId,
      targetId: input.userId,
      action: ACTIONS[input.decision],
      reasonCode: input.reasonCode,
      notes: input.notes,
      statusBefore,
      statusAfter: transition.kycStatus,
      requestId: input.audit.requestId,
      ip: input.audit.ip,
      userAgent: input.audit.userAgent,
      createdAt: input.now,
    });

    return { kind: 'decided', statusBefore, statusAfter: transition.kycStatus };
  }
}
