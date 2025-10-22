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

  it('should format a number correctly with showAllDecimals option enabled', () => {
    expect(formatNumber(123.456, { showAllDecimals: false })).toEqual('123.46');
  });

  it('should format a number correctly with showAllDecimals option disabled', () => {
    expect(formatNumber(123456, { showAllDecimals: false })).toEqual('123,456');
  });

  it('should format a number correctly with showAllDecimals option enabled and compact option enabled', () => {
    expect(formatNumber(123456, { showAllDecimals: true, compact: true })).toEqual('123.456k');
  });

  it('should format a number correctly with showAllDecimals option enabled and compact option disabled', () => {
    expect(formatNumber(123456, { showAllDecimals: true, compact: false })).toEqual('123,456');
  });

  it('should not show .00 when keepDecimals is true but number has no decimals', () => {
    expect(formatNumber(100, { keepDecimals: true })).toEqual('100');
  });

  it('should show decimals when keepDecimals is true and number has decimals', () => {
    expect(formatNumber(100.5, { keepDecimals: true })).toEqual('100.50');
  });

  it('should not show .00 when keepDecimals is true and compact is true for whole numbers', () => {
    expect(formatNumber(1000, { keepDecimals: true, compact: true })).toEqual('1k');
  });

  it('should show decimals when keepDecimals is true and compact is true for numbers with decimals', () => {
    expect(
      formatNumber(1000.5, { keepDecimals: true, compact: true, showAllDecimals: true }),
    ).toEqual('1.0005k');
  });
});
