import {
  buildDetailQuery,
  buildRecommendationInsert,
  buildSearchQuery,
} from './discovery-queries';
import type { SearchCriteria } from './discovery.types';

const CALLER = '11111111-1111-4111-8111-111111111111';

function criteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    callerId: CALLER,
    ageMinimums: { male: 21, female: 18 },
    filters: {},
    after: null,
    fetch: 21,
    ...overrides,
  };
}

describe('discovery queries', () => {
  it('applies every hard filter in the WHERE clause', () => {
    const { text } = buildSearchQuery(criteria());

    expect(text).toContain(`u."profileReviewStatus" = 'approved'`);
    expect(text).toContain(`u."accountStatus" = 'active'`);
    expect(text).toContain('u."id" <> $1');
    expect(text).toContain('"HiddenProfiles"');
    expect(text).toContain('pp."dateOfBirth" <=');
  });

  it('never counts rows', () => {
    expect(buildSearchQuery(criteria()).text.toLowerCase()).not.toContain(
      'count(',
    );
  });

  it('puts filter values in parameters, never in the SQL text', () => {
    const hostile = "x'; DROP TABLE \"Users\"; --";
    const { text, values } = buildSearchQuery(
      criteria({ filters: { city: hostile, religion: 'Hindu' } }),
    );

    expect(text).not.toContain('DROP TABLE');
    expect(text).not.toContain('Hindu');
    expect(values).toEqual(expect.arrayContaining([hostile, 'Hindu']));
  });

  it.each([
    ['maritalStatus', 'pp."maritalStatus"'],
    ['religion', 'pr."religion"'],
    ['community', 'pr."caste"'],
    ['state', 'pl."state"'],
    ['city', 'pl."city"'],
    ['diet', 'pp."eatingHabits"'],
  ] as const)('filters %s on its allowlisted column', (name, column) => {
    const { text } = buildSearchQuery(criteria({ filters: { [name]: 'v' } }));

    expect(text).toContain(column);
  });

  it('adds a keyset condition after a cursor and asks for one extra row', () => {
    const { text, values } = buildSearchQuery(
      criteria({
        after: {
          createdAt: '2026-11-14T10:00:00.123456',
          profileRef: 'b'.repeat(32),
        },
      }),
    );

    expect(text).toContain('(p."createdAt", p."profileRef") <');
    expect(values).toEqual(
      expect.arrayContaining(['2026-11-14T10:00:00.123456', 'b'.repeat(32)]),
    );
    expect(values).toContain(21);
  });

  it('keeps the caller, age gate and ref as parameters in the detail query', () => {
    const { text, values } = buildDetailQuery(
      CALLER,
      { male: 21, female: 18 },
      'c'.repeat(32),
    );

    expect(text).toContain(`u."profileReviewStatus" = 'approved'`);
    expect(values.slice(0, 3)).toEqual([CALLER, 21, 18]);
    expect(values).toContain('c'.repeat(32));
  });

  it('builds the recommendation insert from the same hard filters', () => {
    const { text, values } = buildRecommendationInsert(
      CALLER,
      { male: 21, female: 18 },
      9,
    );

    expect(text).toContain('INSERT INTO "DailyRecommendations"');
    expect(text).toContain(`u."profileReviewStatus" = 'approved'`);
    expect(text).toContain('"HiddenProfiles"');
    expect(values).toEqual([CALLER, 21, 18, 9]);
  });
});
