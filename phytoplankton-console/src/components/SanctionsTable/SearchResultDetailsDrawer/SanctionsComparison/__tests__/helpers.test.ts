import { describe, expect } from '@jest/globals';
import { reduceMatched } from '../helpers';

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
});
