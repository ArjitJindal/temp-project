import { describe, expect, test } from '@jest/globals';
import { isEqual, isPrefix, removePrefix } from '../export';

describe('keys', () => {
  describe('removePrefix', () => {
    test('should remove prefix', () => {
      expect(removePrefix(['a', 'b', 'c'], ['a', 'b'])).toEqual(['c']);
    });
    test('should remove all prefix if match', () => {
      expect(removePrefix(['a', 'b'], ['a', 'b'])).toEqual([]);
    });
    test('should return original key if prefix is longer', () => {
      expect(removePrefix(['a', 'b'], ['a', 'b', 'c'])).toEqual(['a', 'b']);
    });
    test('should return original key if prefix does not match', () => {
      expect(removePrefix(['a', 'b', 'c'], ['x', 'y'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('isPrefix', () => {
    test('should return false if prefix is longer', () => {
      expect(isPrefix(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    });
    test('should return true if prefix is shorter and matches', () => {
      expect(isPrefix(['a', 'b', 'c'], ['a', 'b'])).toBe(true);
    });
    test('should return true if prefix is equal', () => {
      expect(isPrefix(['a', 'b'], ['a', 'b'])).toBe(true);
    });
    test('should return false if prefix does not match', () => {
      expect(isPrefix(['a', 'b', 'c'], ['x', 'y'])).toBe(false);
    });
  });

  describe('isEqual', () => {
    test('should return true if keys are equal', () => {
      expect(isEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });
    test('should return false if keys have different length', () => {
      expect(isEqual(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    });
    test('should return false if keys are not equal', () => {
      expect(isEqual(['a', 'b'], ['a', 'c'])).toBe(false);
    });
  });
});
