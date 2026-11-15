import { describe, expect, it } from 'vitest';
import {
  buildSearchParams,
  filtersFromQuery,
  filtersToQuery,
  formatAge,
  displayValue,
  mergePage,
  EMPTY_FILTERS,
} from './discovery';

describe('buildSearchParams', () => {
  it('keeps only the shipping filters, cursor and limit', () => {
    const params = buildSearchParams({
      maritalStatus: 'divorced',
      religion: 'Hindu',
      community: 'Dhobi',
      state: 'Gujarat',
      city: 'Surat',
      diet: 'vegetarian',
      cursor: 'abc',
      limit: 20,
    });
    expect(params.toString()).toBe(
      'maritalStatus=divorced&religion=Hindu&community=Dhobi&state=Gujarat&city=Surat&diet=vegetarian&cursor=abc&limit=20',
    );
  });

  it('drops empty and whitespace-only values and trims the rest', () => {
    const params = buildSearchParams({ city: '  Surat ', religion: '   ', state: '', cursor: '' });
    expect(params.toString()).toBe('city=Surat');
  });

  it('cannot produce age, height or profile uid parameters', () => {
    const params = buildSearchParams({
      ageMin: 20,
      ageMax: 30,
      heightMin: 150,
      heightMax: 180,
      profileUid: 'DM-1',
      sort: 'password',
      city: 'Surat',
    });
    for (const key of ['ageMin', 'ageMax', 'heightMin', 'heightMax', 'profileUid', 'sort']) {
      expect(params.has(key)).toBe(false);
    }
    expect(params.toString()).toBe('city=Surat');
  });

  it('ignores a limit that is not a positive integer', () => {
    expect(buildSearchParams({ limit: 0 }).toString()).toBe('');
    expect(buildSearchParams({ limit: 2.5 }).toString()).toBe('');
    expect(buildSearchParams({ limit: Number.NaN }).toString()).toBe('');
  });
});

describe('URL query and filters', () => {
  it('parses a query into filters and ignores unknown keys', () => {
    const filters = filtersFromQuery(new URLSearchParams('city=Surat&ageMin=20&profileUid=x&diet=vegetarian'));
    expect(filters).toEqual({ ...EMPTY_FILTERS, city: 'Surat', diet: 'vegetarian' });
  });

  it('drops enum values the server would reject', () => {
    const filters = filtersFromQuery(new URLSearchParams('diet=carnivore&maritalStatus=single'));
    expect(filters.diet).toBe('');
    expect(filters.maritalStatus).toBe('');
  });

  it('writes only non-empty filters and round-trips', () => {
    const filters = { ...EMPTY_FILTERS, city: ' Surat ', religion: 'Hindu', diet: 'eggetarian' };
    const query = filtersToQuery(filters);
    expect(query.toString()).toBe('religion=Hindu&city=Surat&diet=eggetarian');
    expect(filtersFromQuery(query)).toEqual({ ...filters, city: 'Surat' });
  });

  it('writes an empty query for empty filters', () => {
    expect(filtersToQuery(EMPTY_FILTERS).toString()).toBe('');
  });
});

describe('mergePage', () => {
  const card = (profileRef: string) => ({ profileRef });

  it('appends new items and skips duplicates by profileRef', () => {
    const merged = mergePage([card('a'), card('b')], [card('b'), card('c')]);
    expect(merged.map((c) => c.profileRef)).toEqual(['a', 'b', 'c']);
  });

  it('dedupes inside the incoming page and keeps order', () => {
    const merged = mergePage([], [card('x'), card('x'), card('y')]);
    expect(merged.map((c) => c.profileRef)).toEqual(['x', 'y']);
  });
});

describe('card formatters', () => {
  it('formats age', () => {
    expect(formatAge(29)).toBe('29 years');
    expect(formatAge(1)).toBe('1 year');
    expect(formatAge(null)).toBe('');
    expect(formatAge(-3)).toBe('');
  });

  it('falls back for missing values', () => {
    expect(displayValue('Surat')).toBe('Surat');
    expect(displayValue(null)).toBe('Not shared');
    expect(displayValue('   ')).toBe('Not shared');
  });
});
