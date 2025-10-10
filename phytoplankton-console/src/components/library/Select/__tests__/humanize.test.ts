import { describe, expect } from '@jest/globals';
import { filterOption } from '@/components/library/Select/helpers';

describe('helpers', () => {
  describe('filterOption', () => {
    test('exact=false', () => {
      expect(filterOption('aaa', { value: 'aaa', label: 'AAA' })).toBe(true);
      expect(filterOption('aaa', { value: 'aaabbb', label: 'BBB' })).toBe(true);
      expect(filterOption('aaa', { value: 'aAabbb', label: 'BBB' })).toBe(true);
      expect(filterOption('aaa', { value: 'ccc', label: 'aAa' })).toBe(true);
      expect(filterOption('aaa', { value: 'ccc', label: 'AAA' })).toBe(true);
      expect(filterOption('aaa', { value: 'bbb', label: 'BBB' })).toBe(false);
      expect(filterOption('aaa', { value: 'a', label: 'A' })).toBe(false);
    });
    test('exact=true', () => {
      expect(filterOption('aaa', { value: 'aaa', label: 'BBB' }, true)).toBe(true);
      expect(filterOption('aaa', { value: 'AAA', label: 'BBB' }, true)).toBe(true);
      expect(filterOption('aaa', { value: 'bbb', label: 'AAA' }, true)).toBe(true);
      expect(filterOption('aaa', { value: 'aaabbb', label: 'AAA' }, true)).toBe(true);
      expect(filterOption('aaa', { value: 'aaabbb', label: 'BBB' }, true)).toBe(false);
      expect(filterOption('aaa', { value: 'aaab', label: 'BBB' }, true)).toBe(false);
    });
  });
});
