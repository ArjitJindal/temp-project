/*
  SOME_CONSTANT_NAME => Some Constant Name
 */
import { describe, expect } from '@jest/globals';
import { humanizeCamelCase } from '../humanize';

describe('humanize', () => {
  // describe('humanizeConstant', () => {
  //   expect(humanizeConstant('SOME_CONSTANT')).toEqual('Some Constant');
  // })
  test('humanizeCamelCase', () => {
    expect(humanizeCamelCase('')).toEqual('');
    expect(humanizeCamelCase('f')).toEqual('F');
    expect(humanizeCamelCase('F')).toEqual('F');
    expect(humanizeCamelCase('fN')).toEqual('F N');
    expect(humanizeCamelCase('field')).toEqual('Field');
    expect(humanizeCamelCase('fieldName')).toEqual('Field name');
    expect(humanizeCamelCase('someFieldName')).toEqual('Some field name');
    expect(humanizeCamelCase('BankSmartIBAN')).toEqual('Bank smart IBAN');
    expect(humanizeCamelCase('BankSmartIBANWithBIC')).toEqual('Bank smart IBAN with BIC');
    expect(humanizeCamelCase('IBAN')).toEqual('IBAN');
    expect(humanizeCamelCase('FB')).toEqual('FB');
    expect(humanizeCamelCase('UserIBANNumber')).toEqual('User IBAN number');
    expect(humanizeCamelCase('fiveShortSimpleWordsHere')).toEqual('Five short simple words here');
  });
});
