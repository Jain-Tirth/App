import { describe, expect, it } from 'vitest';
import type { ReviewDecision } from '../types';
import { decisionViewFor, flaggedSections, toReviewView } from './reviewDecision';

describe('decisionViewFor', () => {
  it('shows the stored reason, notes and sections for needsChanges', () => {
    const view = decisionViewFor(
      'needsChanges',
      {
        decision: 'changesRequested',
        reasonCode: 'incomplete-profile',
        notes: 'Add more.',
        sections: ['step-2'],
        decidedAt: null,
      },
      null,
    );
    expect(view).toMatchObject({
      kind: 'changesRequested',
      reasonLabel: 'Your profile is incomplete',
      notes: 'Add more.',
    });
    expect(view.kind === 'changesRequested' && view.sections.map((s) => s.step)).toEqual([2]);
  });

  it('falls back to a generic changes panel when no decision is stored', () => {
    expect(decisionViewFor('needsChanges', null, null)).toEqual({
      kind: 'changesRequested',
      reasonLabel: 'Your profile needs attention',
      notes: null,
      sections: [],
      kycRestart: false,
    });
  });

  it('makes a rejected profile final with no restart, using the stored reason', () => {
    const view = decisionViewFor(
      'rejected',
      {
        decision: 'rejected',
        reasonCode: 'expired-document',
        notes: 'Expired.',
        sections: [],
        decidedAt: null,
      },
      null,
    );
    expect(view).toEqual({
      kind: 'rejected',
      reasonLabel: 'Your document has expired',
      notes: 'Expired.',
      final: true,
      kycRestart: false,
    });
  });

  it('uses the legacy rejection reason when no decision is stored', () => {
    expect(decisionViewFor('rejected', null, 'Not eligible')).toEqual({
      kind: 'rejected',
      reasonLabel: 'Your profile needs attention',
      notes: 'Not eligible',
      final: true,
      kycRestart: false,
    });
  });
});

const decision = (overrides: Partial<ReviewDecision>): ReviewDecision => ({
  decision: 'changesRequested',
  reasonCode: 'incomplete-profile',
  notes: 'Please add more detail.',
  sections: ['step-1', 'step-4'],
  decidedAt: '2026-11-14T10:00:00Z',
  ...overrides,
});

describe('toReviewView', () => {
  it('is submitted when there is no decision', () => {
    expect(toReviewView(null, 'pending')).toEqual({ kind: 'submitted' });
    expect(toReviewView(undefined, 'pending')).toEqual({ kind: 'submitted' });
  });

  it('is approved for an active account', () => {
    expect(toReviewView(decision({ decision: 'approved' }), 'active')).toEqual({ kind: 'approved' });
  });

  it('maps request changes to a reason label, notes and linked sections', () => {
    const view = toReviewView(decision({}), 'pending');
    expect(view).toMatchObject({
      kind: 'changesRequested',
      reasonLabel: 'Your profile is incomplete',
      notes: 'Please add more detail.',
      kycRestart: false,
    });
    if (view.kind !== 'changesRequested') throw new Error('unexpected');
    expect(view.sections.map((s) => s.step)).toEqual([1, 4]);
  });

  it.each(['unreadable-document', 'expired-document', 'name-mismatch', 'photo-mismatch'])(
    'links %s to the KYC restart',
    (reasonCode) => {
      const view = toReviewView(decision({ reasonCode }), 'pending');
      expect(view).toMatchObject({ kind: 'changesRequested', kycRestart: true });
    },
  );

  it.each(['under-age', 'duplicate-account'])('treats rejection for %s as final', (reasonCode) => {
    expect(toReviewView(decision({ decision: 'rejected', reasonCode }), 'rejected')).toMatchObject({
      kind: 'rejected',
      final: true,
    });
  });

  it('keeps other rejections editable and shows the admin reason', () => {
    expect(
      toReviewView(
        decision({ decision: 'rejected', reasonCode: 'prohibited-content', notes: 'Remove it.' }),
        'rejected',
      ),
    ).toMatchObject({ kind: 'rejected', final: false, notes: 'Remove it.' });
  });
});

describe('flaggedSections', () => {
  it('keeps only step-1 to step-5', () => {
    expect(flaggedSections(['step-2', 'step-9', 'x']).map((s) => s.step)).toEqual([2]);
  });
});
