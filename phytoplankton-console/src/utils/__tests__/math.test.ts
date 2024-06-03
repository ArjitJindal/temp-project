import { describe, expect } from '@jest/globals';
import { hasOverlaps } from '@/utils/math';

describe('checkOverlap', () => {
  test('empty set of ranges can not overlap with anything', () => {
    expect(hasOverlaps([])).toEqual(false);
  });
  test('single range can not overlap with anything', () => {
    expect(hasOverlaps([[1, 2]])).toEqual(false);
  });
  test('different no-overlap scenarious', () => {
    // min1 [----}     max1
    // min2        [-----} max2
    expect(
      hasOverlaps([
        [10, 20],
        [30, 40],
      ]),
    ).toEqual(false);

    // min1 [----}     max1
    // min2      [-----} max2
    expect(
      hasOverlaps([
        [10, 20],
        [20, 40],
      ]),
    ).toEqual(false);

    // min1       [----} max1
    // min2 [-----}      max2
    expect(
      hasOverlaps([
        [30, 50],
        [10, 30],
      ]),
    ).toEqual(false);
  });
  test('different overlap scenarious', () => {
    // min1 [----}     max1
    // min2    [-----} max2
    expect(
      hasOverlaps([
        [10, 30],
        [20, 40],
      ]),
    ).toEqual(true);

    // min1 [----------}     max1
    // min2    [---} max2
    expect(
      hasOverlaps([
        [10, 50],
        [20, 40],
      ]),
    ).toEqual(true);

    // min1   [------}     max1
    // min2 [----------} max2
    expect(
      hasOverlaps([
        [20, 30],
        [10, 50],
      ]),
    ).toEqual(true);

    // min1 [------}     max1
    // min2 [----------} max2
    expect(
      hasOverlaps([
        [10, 30],
        [10, 50],
      ]),
    ).toEqual(true);

    // min1 [---------}     max1
    // min2 [------}    max2
    expect(
      hasOverlaps([
        [10, 50],
        [10, 30],
      ]),
    ).toEqual(true);

    // min1 [---------}     max1
    // min2      [------}    max2
    expect(
      hasOverlaps([
        [10, 30],
        [20, 40],
      ]),
    ).toEqual(true);
  });
  test('start and end can go in any order, min is always start, max is always end', () => {
    // min1 [----}     max1
    // min2    [-----} max2
    expect(
      hasOverlaps([
        [30, 10],
        [20, 40],
      ]),
    ).toEqual(true);
  });
  test('multiple ranges can cross in any order', () => {
    // min1 [-------}           max1
    // min2           [-----}   max2
    // min3    [---}            max3
    expect(
      hasOverlaps([
        [10, 30],
        [40, 50],
        [21, 22],
      ]),
    ).toEqual(true);
  });
});
