import { describe, expect } from '@jest/globals';
import { calculateScaleMax } from '../charts';

describe('test calculateScaleMax', () => {
  test('Simple case', () => {
    expect(calculateScaleMax(100)).toEqual(100);
    expect(calculateScaleMax(10)).toEqual(10);
  });
  test('Rounding to hundred', () => {
    expect(calculateScaleMax(0.9)).toEqual(1);
    expect(calculateScaleMax(9)).toEqual(10);
    expect(calculateScaleMax(99)).toEqual(100);
    expect(calculateScaleMax(999)).toEqual(1000);
    expect(calculateScaleMax(9999)).toEqual(10000);
    expect(calculateScaleMax(99999)).toEqual(100000);
  });
  test('rounding to 25', () => {
    expect(calculateScaleMax(11)).toEqual(25);
    expect(calculateScaleMax(25)).toEqual(25);
    expect(calculateScaleMax(11.11)).toEqual(25);
    expect(calculateScaleMax(1111)).toEqual(2500);
  });
  test('rounding to 50', () => {
    expect(calculateScaleMax(26)).toEqual(50);
    expect(calculateScaleMax(49)).toEqual(50);
    expect(calculateScaleMax(50)).toEqual(50);
    expect(calculateScaleMax(49.11)).toEqual(50);
    expect(calculateScaleMax(4911)).toEqual(5000);
    expect(calculateScaleMax(4911.11)).toEqual(5000);
  });
  test('rounding to 75', () => {
    expect(calculateScaleMax(51)).toEqual(75);
    expect(calculateScaleMax(74)).toEqual(75);
    expect(calculateScaleMax(75)).toEqual(75);
    expect(calculateScaleMax(74.11)).toEqual(75);
    expect(calculateScaleMax(7411)).toEqual(7500);
    expect(calculateScaleMax(7411.111)).toEqual(7500);
  });
});
