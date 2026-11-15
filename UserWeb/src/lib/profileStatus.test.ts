import { describe, expect, it } from 'vitest';
import {
  allowedActions,
  missingItemLabel,
  missingItemTarget,
  readMissingItems,
  routeForStatus,
} from './profileStatus';

describe('routeForStatus', () => {
  it.each([
    ['draft', '/register'],
    ['submitted', '/pending'],
    ['needsChanges', '/pending'],
    ['rejected', '/pending'],
    ['approved', '/app'],
  ] as const)('%s goes to %s', (status, path) => {
    expect(routeForStatus(status)).toBe(path);
  });
});

describe('missingItemLabel', () => {
  it.each([
    ['step-1', 'Step 1 of your profile'],
    ['step-5', 'Step 5 of your profile'],
    ['kycPhoto', 'Your photo'],
    ['kycId', 'Your ID document'],
    ['consent', 'Your consent to the terms'],
    ['step-6', 'Another required item'],
    ['somethingNew', 'Another required item'],
  ])('%s reads "%s"', (item, label) => {
    expect(missingItemLabel(item)).toBe(label);
  });
});

describe('missingItemTarget', () => {
  it('links wizard steps, KYC items and consent to their screens', () => {
    expect(missingItemTarget('step-3')).toBe('/register?step=3');
    expect(missingItemTarget('kycPhoto')).toBe('/kyc');
    expect(missingItemTarget('kycId')).toBe('/kyc');
    expect(missingItemTarget('consent')).toBe('/kyc');
    expect(missingItemTarget('unknown')).toBe('/register');
  });
});

describe('readMissingItems', () => {
  it('reads the missing list from error details', () => {
    expect(readMissingItems({ missing: ['step-2', 'kycId'] })).toEqual(['step-2', 'kycId']);
  });

  it('returns an empty list when details carry no list', () => {
    expect(readMissingItems(null)).toEqual([]);
    expect(readMissingItems({ missing: 'step-2' })).toEqual([]);
    expect(readMissingItems({ missing: [1, 'kycId'] })).toEqual(['kycId']);
  });
});

describe('allowedActions', () => {
  it('shows Submit only for draft', () => {
    expect(allowedActions('draft')).toEqual({ submit: true, submitAgain: false, withdraw: false });
  });

  it('shows Submit again only for needsChanges', () => {
    expect(allowedActions('needsChanges')).toEqual({ submit: false, submitAgain: true, withdraw: false });
  });

  it('shows Withdraw only for submitted', () => {
    expect(allowedActions('submitted')).toEqual({ submit: false, submitAgain: false, withdraw: true });
  });

  it.each(['approved', 'rejected'] as const)('shows nothing for %s', (status) => {
    expect(allowedActions(status)).toEqual({ submit: false, submitAgain: false, withdraw: false });
  });
});
