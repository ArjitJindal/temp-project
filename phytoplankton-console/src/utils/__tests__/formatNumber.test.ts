import { describe, expect } from '@jest/globals';
import { formatNumber } from '../number';

describe('formatNumber', () => {
  it('should format a number correctly without options', () => {
    expect(formatNumber(1234)).toEqual('1,234');
  });

  it('should format a number correctly with compact option disabled', () => {
    expect(formatNumber(123456, { compact: false })).toEqual('123,456');
  });

  it('should format a number correctly with compact option enabled', () => {
    expect(formatNumber(123456, { compact: true })).toEqual('123.46k');
  });

  it('should format a number correctly with compact and keepDecimals options enabled', () => {
    expect(formatNumber(123456, { compact: true, keepDecimals: true })).toEqual('123.46k');
  });

  it('should format a number correctly with compact and keepDecimals options disabled', () => {
    expect(formatNumber(123456, { compact: true, keepDecimals: false })).toEqual('123.46k');
  });

  it('should format 0 correctly without options', () => {
    expect(formatNumber(0)).toEqual('0');
  });

  it('should format 0 correctly with compact option enabled', () => {
    expect(formatNumber(0, { compact: true })).toEqual('0');
  });

  it('should format a large number correctly with compact option enabled', () => {
    expect(formatNumber(1234567890, { compact: true })).toEqual('1,234.57m');
  });

  it('should format a small number correctly with compact option enabled', () => {
    expect(formatNumber(12.345, { compact: true })).toEqual('12.35');
  });
});
