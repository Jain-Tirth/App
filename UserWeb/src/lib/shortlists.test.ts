import { describe, expect, it } from 'vitest';
import type { DiscoveryCard, Shortlist } from '../types';
import {
  isMember,
  mergeCardPage,
  mergeMembership,
  orderLists,
  setMembership,
  validateListName,
} from './shortlists';

function card(profileRef: string, firstName = 'Asha'): DiscoveryCard {
  return {
    profileRef,
    firstName,
    age: 28,
    city: null,
    religion: null,
    community: null,
    profession: null,
    photoRef: null,
    verified: false,
  };
}

function list(id: string, name: string, isDefault: boolean, createdAt: string): Shortlist {
  return { id, name, isDefault, profileCount: 0, createdAt };
}

describe('validateListName', () => {
  it('trims and accepts a normal name', () => {
    expect(validateListName('  Family picks  ')).toEqual({ ok: true, name: 'Family picks' });
  });

  it('rejects empty and whitespace-only input with the friendly sentence', () => {
    const expected = { ok: false, message: 'Enter a name for your list.' };
    expect(validateListName('')).toEqual(expected);
    expect(validateListName('   \t ')).toEqual(expected);
  });

  it('accepts exactly 100 characters and rejects 101', () => {
    expect(validateListName('a'.repeat(100)).ok).toBe(true);
    expect(validateListName('a'.repeat(101))).toEqual({
      ok: false,
      message: 'Use 100 characters or fewer.',
    });
  });

  it('counts the trimmed length', () => {
    expect(validateListName(` ${'a'.repeat(100)} `).ok).toBe(true);
  });
});

describe('orderLists', () => {
  it('puts the default list first, then oldest first, without mutating the input', () => {
    const input = [
      list('c', 'Third', false, '2026-03-01T00:00:00.000Z'),
      list('d', 'Shortlisted', true, '2026-05-01T00:00:00.000Z'),
      list('b', 'Second', false, '2026-02-01T00:00:00.000Z'),
    ];
    const ordered = orderLists(input);
    expect(ordered.map((l) => l.id)).toEqual(['d', 'b', 'c']);
    expect(input.map((l) => l.id)).toEqual(['c', 'd', 'b']);
  });
});

describe('mergeCardPage', () => {
  it('appends new cards in order and skips those already shown', () => {
    const merged = mergeCardPage([card('a'), card('b')], [card('b'), card('c')]);
    expect(merged.map((c) => c.profileRef)).toEqual(['a', 'b', 'c']);
  });

  it('drops a duplicate repeated inside one page', () => {
    expect(mergeCardPage([], [card('a'), card('a')])).toHaveLength(1);
  });
});

describe('membership helpers', () => {
  it('merges the refs of a page into one list without touching the others', () => {
    const start = { l1: ['a'], l2: ['z'] };
    const next = mergeMembership(start, 'l1', [card('a'), card('b')]);
    expect(next.l1).toEqual(['a', 'b']);
    expect(next.l2).toEqual(['z']);
    expect(start.l1).toEqual(['a']);
  });

  it('starts an unknown list from empty', () => {
    expect(mergeMembership({}, 'l1', [card('a')])).toEqual({ l1: ['a'] });
    expect(mergeMembership({}, 'l1', [])).toEqual({ l1: [] });
  });

  it('records one confirmed add and one confirmed remove', () => {
    const added = setMembership({ l1: [] }, 'l1', 'a', true);
    expect(isMember(added, 'l1', 'a')).toBe(true);
    const removed = setMembership(added, 'l1', 'a', false);
    expect(isMember(removed, 'l1', 'a')).toBe(false);
    expect(isMember(removed, 'other', 'a')).toBe(false);
  });
});
