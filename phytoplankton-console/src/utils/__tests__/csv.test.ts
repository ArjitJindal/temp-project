import { describe, expect, test } from '@jest/globals';
import { csvValue } from '../csv';

describe('test csvValue', () => {
  test('handles null and empty string', () => {
    expect(csvValue(null)).toEqual({ escaped: '"-"' });
    expect(csvValue('')).toEqual({ escaped: '"-"' });
  });

  test('handles number and boolean', () => {
    expect(csvValue(123)).toEqual({ escaped: '"123"' });
    expect(csvValue(true)).toEqual({ escaped: '"true"' });
  });

  test('handles string', () => {
    expect(csvValue('test')).toEqual({ escaped: '"test"' });
    expect(csvValue('""')).toEqual({ escaped: '"-"' });
  });

  test('handles array', () => {
    expect(csvValue(['a', 'b', 'c'])).toEqual({ escaped: '"a, b, c"' });
  });

  test('handles object', () => {
    expect(csvValue({ a: 1, b: 2 })).toEqual({ escaped: '"{a:1,b:2}"' });
  });

  test('handles empty or whitespace string', () => {
    expect(csvValue(' ')).toEqual({ escaped: '"-"' });
    expect(csvValue('""')).toEqual({ escaped: '"-"' });
  });
});
