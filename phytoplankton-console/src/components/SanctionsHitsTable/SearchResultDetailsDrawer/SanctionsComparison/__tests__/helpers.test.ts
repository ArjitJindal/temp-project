import { describe, expect } from '@jest/globals';
import { getComparisonItems, reduceMatched } from '../helpers';
import { SanctionsMatchTypeDetails } from '@/apis';
import { SanctionsComparisonTableItem } from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer/SanctionsComparison/types';

describe('reduceMatched', () => {
  it('empty array should return NO_HIT', () => {
    const result = reduceMatched([]);
    expect(result).toBe('NO_HIT');
  });
  it('single match element with exact match should return TRUE_HIT', () => {
    const result = reduceMatched([
      {
        match_types: ['exact_match'],
        query_term: 'putin',
      },
    ]);
    expect(result).toBe('TRUE_HIT');
  });
  it('single match element with unknown match should return NO_HIT', () => {
    const result = reduceMatched([
      {
        // @ts-expect-error Expect error since this value is not in enum
        match_types: ['unknown_match_value'],
        query_term: 'putin',
      },
    ]);
    expect(result).toBe('POTENTIAL_HIT');
  });
  it('every match element with exact match should return TRUE_HIT', () => {
    const result = reduceMatched([
      {
        match_types: ['exact_match'],
        query_term: 'putin',
      },
      {
        match_types: ['exact_match'],
        query_term: 'vladimir',
      },
    ]);
    expect(result).toBe('TRUE_HIT');
  });
  it('if every match element is not exact - result should be POTENTIAL_HIT', () => {
    const result = reduceMatched([
      {
        match_types: ['edit_distance'],
        query_term: 'butin',
      },
      {
        match_types: ['phonetic'],
        query_term: 'bladimir',
      },
    ]);
    expect(result).toBe('POTENTIAL_HIT');
  });
  it('if any match element is not exact - result should be POTENTIAL_HIT', () => {
    const result = reduceMatched([
      {
        match_types: ['exact_match'],
        query_term: 'putin',
      },
      {
        match_types: ['edit_distance'],
        query_term: 'bladimir',
      },
    ]);
    expect(result).toBe('POTENTIAL_HIT');
  });
  test('for every term the most strongest hit should be considered', () => {
    const result = reduceMatched([
      {
        match_types: ['edit_distance', 'exact_match'],
        query_term: 'putin',
      },
      {
        match_types: ['exact_match', 'edit_distance'],
        query_term: 'vladimir',
      },
    ]);
    expect(result).toBe('TRUE_HIT');
  });
});

describe('getComparisonItems', () => {
  it('should return correct items for a simple case', () => {
    const matchTypeDetails: SanctionsMatchTypeDetails[] = [
      {
        sources: ['source1'],
        matchingName: 'John Doe',
        secondaryMatches: [{ query_term: '01-01-1990' }],
        nameMatches: [{ match_types: ['exact_match'] }],
      },
    ];

    const expectedItems: SanctionsComparisonTableItem[] = [
      {
        title: 'Name',
        screeningValue: 'John Doe',
        kycValue: 'John Doe',
        match: 'TRUE_HIT',
        sources: ['source1'],
      },
      {
        title: 'Date of birth',
        screeningValue: '01-01-1990',
        kycValue: 1990,
        match: 'NO_HIT',
        sources: ['source1'],
      },
    ];

    expect(
      getComparisonItems(matchTypeDetails, {
        entity: 'USER',
        searchTerm: 'John Doe',
        yearOfBirth: 1990,
      }),
    ).toEqual(expectedItems);
  });

  it('should handle empty input gracefully', () => {
    expect(getComparisonItems([], { entity: 'USER' })).toEqual([]);
  });

  it('should group items by title, screeningValue, kycValue, and match', () => {
    const matchTypeDetails: SanctionsMatchTypeDetails[] = [
      {
        sources: ['source1'],
        matchingName: 'Jane Smith',
        secondaryMatches: [{ query_term: '02-02-1985' }],
        nameMatches: [{ match_types: ['exact_match'] }],
      },
      {
        sources: ['source2'],
        matchingName: 'Jane Smith',
        secondaryMatches: [{ query_term: '02-02-1985' }],
        nameMatches: [{ match_types: ['exact_match'] }],
      },
    ];

    const expectedItems: SanctionsComparisonTableItem[] = [
      {
        title: 'Name',
        screeningValue: 'Jane Smith',
        kycValue: 'Jane Smith',
        match: 'TRUE_HIT',
        sources: ['source1', 'source2'],
      },
      {
        title: 'Date of birth',
        screeningValue: '02-02-1985',
        kycValue: 1985,
        match: 'NO_HIT',
        sources: ['source1', 'source2'],
      },
    ];

    expect(
      getComparisonItems(matchTypeDetails, {
        entity: 'USER',
        searchTerm: 'Jane Smith',
        yearOfBirth: 1985,
      }),
    ).toEqual(expectedItems);
  });
});
