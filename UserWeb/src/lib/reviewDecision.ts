import type { ReviewDecision } from '../types';

export const REASON_LABELS: Record<string, string> = {
  'unreadable-document': 'Your document could not be read clearly',
  'expired-document': 'Your document has expired',
  'name-mismatch': 'The name on your document does not match your profile',
  'photo-mismatch': 'Your photo does not match your document',
  'under-age': 'You do not meet the minimum age',
  'prohibited-content': 'Your profile contains content that is not allowed',
  'incomplete-profile': 'Your profile is incomplete',
  'duplicate-account': 'This looks like a duplicate of another account',
  'suspicious-activity': 'We noticed activity that needs attention',
  'terms-violation': 'Your profile does not follow our terms',
  other: 'Your profile needs attention',
};

const DOCUMENT_REASONS = ['unreadable-document', 'expired-document', 'name-mismatch', 'photo-mismatch'];
const FINAL_REASONS = ['under-age', 'duplicate-account'];

export const SECTION_LABELS: Record<number, string> = {
  1: 'Personal details',
  2: 'Religion and cultural',
  3: 'Location and residence',
  4: 'Education and career',
  5: 'Family and partner',
};

export interface FlaggedSection {
  section: string;
  step: number;
  label: string;
}

export type ReviewView =
  | { kind: 'submitted' }
  | { kind: 'approved' }
  | {
      kind: 'changesRequested';
      reasonLabel: string;
      notes: string | null;
      sections: FlaggedSection[];
      kycRestart: boolean;
    }
  | {
      kind: 'rejected';
      reasonLabel: string;
      notes: string | null;
      final: boolean;
      kycRestart: boolean;
    };

export function reasonLabel(code: string | null): string {
  return (code && REASON_LABELS[code]) || REASON_LABELS.other;
}

export function flaggedSections(sections: string[]): FlaggedSection[] {
  const result: FlaggedSection[] = [];
  for (const section of sections) {
    const match = /^step-([1-5])$/.exec(section);
    if (!match) continue;
    const step = Number(match[1]);
    result.push({ section, step, label: SECTION_LABELS[step] });
  }
  return result;
}

export type DecisionView = Extract<ReviewView, { kind: 'changesRequested' | 'rejected' }>;

/**
 * The decision panel content for a `needsChanges` or `rejected` profile. The
 * review status decides which panel shows; the stored decision only supplies
 * the reason, notes and flagged sections. A rejected profile is final until an
 * admin reopens it, so it never offers a restart or an edit.
 */
export function decisionViewFor(
  status: 'needsChanges' | 'rejected',
  decision: ReviewDecision | null | undefined,
  rejectionReason: string | null | undefined,
): DecisionView {
  const stored = toReviewView(decision, 'pending');

  if (status === 'needsChanges') {
    return stored.kind === 'changesRequested'
      ? stored
      : {
          kind: 'changesRequested',
          reasonLabel: reasonLabel(null),
          notes: null,
          sections: [],
          kycRestart: false,
        };
  }

  return {
    kind: 'rejected',
    reasonLabel: stored.kind === 'rejected' ? stored.reasonLabel : reasonLabel(null),
    notes: stored.kind === 'rejected' ? stored.notes : (rejectionReason ?? null),
    final: true,
    kycRestart: false,
  };
}

/** Turns profile.user.reviewDecision and the account status into what the member sees. */
export function toReviewView(
  decision: ReviewDecision | null | undefined,
  accountStatus: string,
): ReviewView {
  if (accountStatus === 'active') return { kind: 'approved' };
  if (!decision || decision.decision === 'approved') return { kind: 'submitted' };

  const kycRestart = decision.reasonCode !== null && DOCUMENT_REASONS.includes(decision.reasonCode);

  if (decision.decision === 'changesRequested') {
    return {
      kind: 'changesRequested',
      reasonLabel: reasonLabel(decision.reasonCode),
      notes: decision.notes,
      sections: flaggedSections(decision.sections ?? []),
      kycRestart,
    };
  }

  return {
    kind: 'rejected',
    reasonLabel: reasonLabel(decision.reasonCode),
    notes: decision.notes,
    final: decision.reasonCode !== null && FINAL_REASONS.includes(decision.reasonCode),
    kycRestart,
  };
}
