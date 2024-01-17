import { describe, it, expect } from '@jest/globals';
import { xlsxValue } from '../xlsx';

describe('xlsxValue', () => {
  it('should return "-" for null or empty string', () => {
    expect(xlsxValue(null)).toEqual('-');
    expect(xlsxValue('')).toEqual('-');
  });

  it('should return string representation for number and boolean', () => {
    expect(xlsxValue(123)).toEqual('123');
    expect(xlsxValue(true)).toEqual('true');
  });

  it('should return "-" for string that is empty or only contains double quotes after trim', () => {
    expect(xlsxValue(' ')).toEqual('-');
    expect(xlsxValue('""')).toEqual('-');
  });

  it('should return original string for non-empty string', () => {
    expect(xlsxValue('hello')).toEqual('hello');
  });

  it('should return joined string for array', () => {
    expect(xlsxValue(['hello', 'world'])).toEqual('hello, world');
  });

  it('should return stringified and quote-stripped version for object', () => {
    expect(xlsxValue({ hello: 'world' })).toEqual('{hello:world}');
  });

  it('should strip double quotes from the string', () => {
    expect(xlsxValue('"hello"')).toEqual('hello');
  });
  it('should truncate to excels limits', () => {
    const output = xlsxValue('a'.repeat(40000));
    expect(output).toHaveLength(32767);
    expect(output.endsWith('aaaaaa... (TRUNCATED)')).toBeTruthy();
  });
});
