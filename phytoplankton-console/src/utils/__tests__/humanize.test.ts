/*
  SOME_CONSTANT_NAME => Some Constant Name
 */
import { describe, expect } from '@jest/globals';
import { humanizeCamelCase, humanizeConstant, humanizeSnakeCase, recognizeCase } from '../humanize';

describe('humanize', () => {
  test('constant case', () => {
    expect(humanizeConstant('SOME_CONSTANT')).toEqual('Some constant');
  });
  test('snake case', () => {
    expect(humanizeSnakeCase('some_constant')).toEqual('Some constant');
  });
  test('camel case', () => {
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

describe('recognize case', () => {
  test('snake case', () => {
    expect(recognizeCase('some_property_name')).toEqual('SNAKE_CASE');
    expect(recognizeCase('some_property_name42')).toEqual('SNAKE_CASE');
    expect(recognizeCase('some_Property_name')).toEqual('UNKNOWN');
    expect(recognizeCase('_some_property_name')).toEqual('UNKNOWN');
    expect(recognizeCase(' some_property_name')).toEqual('UNKNOWN');
  });

  test('camel case', () => {
    expect(recognizeCase('SomePropertyName')).toEqual('CAMEL_CASE');
    expect(recognizeCase('SomePropertyName42')).toEqual('CAMEL_CASE');
    expect(recognizeCase('somePropertyName')).toEqual('CAMEL_CASE');
    expect(recognizeCase('somePropertyName42')).toEqual('CAMEL_CASE');
    expect(recognizeCase('someVIPProperty')).toEqual('CAMEL_CASE');
    expect(recognizeCase(' somePropertyName')).toEqual('UNKNOWN');
    expect(recognizeCase('someProperty_Name')).toEqual('UNKNOWN');
    expect(recognizeCase('someProperty_Name')).toEqual('UNKNOWN');
  });

  test('constant case', () => {
    expect(recognizeCase('SOME')).toEqual('CONSTANT');
    expect(recognizeCase('SOME_PROPERTY')).toEqual('CONSTANT');
    expect(recognizeCase('SOME_PROPERTY42')).toEqual('CONSTANT');
    expect(recognizeCase('SOME_PROPERTY ')).toEqual('UNKNOWN');
    expect(recognizeCase(' SOME_PROPERTY')).toEqual('UNKNOWN');
    expect(recognizeCase('SOME-PROPERTY')).toEqual('UNKNOWN');
  });

  test('unknown case', () => {
    expect(recognizeCase('simple text')).toEqual('UNKNOWN');
    expect(recognizeCase('name')).toEqual('UNKNOWN');
    expect(recognizeCase('a')).toEqual('UNKNOWN');
  });
});
