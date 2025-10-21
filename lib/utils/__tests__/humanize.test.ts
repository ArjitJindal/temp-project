import { describe, expect } from '@jest/globals'
import {
  humanizeCamelCase,
  humanizeConstant,
  humanizeSnakeCase,
  recognizeCase,
  humanizeKebabCase,
} from '../humanize'

describe('humanize', () => {
  describe('constant case', () => {
    test('default params', () => {
      expect(humanizeConstant('SOME_CONSTANT')).toEqual('Some constant')
      expect(humanizeConstant('SOME_IBAN_ABBREVIATION')).toEqual(
        'Some IBAN abbreviation'
      )
    })
    test('no first letter upper case', () => {
      expect(
        humanizeConstant('SOME_CONSTANT', { firstLetterUpper: false })
      ).toEqual('some constant')
      expect(
        humanizeConstant('SOME_IBAN_ABBREVIATION', { firstLetterUpper: false })
      ).toEqual('some IBAN abbreviation')
    })
  })
  describe('snake case', () => {
    test('default params', () => {
      expect(humanizeSnakeCase('some_constant')).toEqual('Some constant')
      expect(humanizeSnakeCase('some_iban_abbreviation')).toEqual(
        'Some IBAN abbreviation'
      )
      expect(humanizeSnakeCase('iban')).toEqual('IBAN')
    })
    test('no first letter upper case', () => {
      expect(
        humanizeSnakeCase('some_constant', { firstLetterUpper: false })
      ).toEqual('some constant')
      expect(
        humanizeSnakeCase('some_iban_abbreviation', { firstLetterUpper: false })
      ).toEqual('some IBAN abbreviation')
      expect(humanizeSnakeCase('iban', { firstLetterUpper: false })).toEqual(
        'IBAN'
      )
    })
  })

  describe('kebab case', () => {
    test('default params', () => {
      expect(humanizeKebabCase('some-constant')).toEqual('Some constant')
      expect(humanizeKebabCase('some-other-constant')).toEqual(
        'Some other constant'
      )
      expect(humanizeKebabCase('some-IBAN-abbr')).toEqual('Some IBAN abbr')
      expect(humanizeKebabCase('iban')).toEqual('IBAN')
    })
    test('no first letter upper case', () => {
      expect(
        humanizeKebabCase('some-constant', { firstLetterUpper: false })
      ).toEqual('some constant')
      expect(
        humanizeKebabCase('some-other-constant', { firstLetterUpper: false })
      ).toEqual('some other constant')
      expect(
        humanizeKebabCase('some-IBAN-abbr', { firstLetterUpper: false })
      ).toEqual('some IBAN abbr')
      expect(humanizeKebabCase('iban', { firstLetterUpper: false })).toEqual(
        'IBAN'
      )
    })
  })

  describe('camel case', () => {
    test('default params', () => {
      expect(humanizeCamelCase('')).toEqual('')
      expect(humanizeCamelCase('f')).toEqual('F')
      expect(humanizeCamelCase('F')).toEqual('F')
      expect(humanizeCamelCase('fN')).toEqual('F N')
      expect(humanizeCamelCase('field')).toEqual('Field')
      expect(humanizeCamelCase('fieldName')).toEqual('Field name')
      expect(humanizeCamelCase('someFieldName')).toEqual('Some field name')
      expect(humanizeCamelCase('BankSmartIBAN')).toEqual('Bank smart IBAN')
      expect(humanizeCamelCase('BankSmartIBANWithBIC')).toEqual(
        'Bank smart IBAN with BIC'
      )
      expect(humanizeCamelCase('IBAN')).toEqual('IBAN')
      expect(humanizeCamelCase('FB')).toEqual('FB')
      expect(humanizeCamelCase('UserIBANNumber')).toEqual('User IBAN number')
      expect(humanizeCamelCase('fiveShortSimpleWordsHere')).toEqual(
        'Five short simple words here'
      )
      expect(humanizeCamelCase('customerAmlRating')).toEqual(
        'Customer AML rating'
      )
    })
    test('no first letter upper case', () => {
      expect(
        humanizeCamelCase('UserIBANNumber', { firstLetterUpper: false })
      ).toEqual('user IBAN number')
      expect(humanizeCamelCase('IBAN', { firstLetterUpper: false })).toEqual(
        'IBAN'
      )
      expect(
        humanizeCamelCase('customerAmlRating', { firstLetterUpper: false })
      ).toEqual('customer AML rating')
      expect(humanizeCamelCase('FB')).toEqual('FB')
    })
  })
})

describe('capitalize abbreviations', () => {
  test('kebab case', () => {
    expect(humanizeKebabCase('some-constant')).toEqual('Some constant')
    expect(humanizeKebabCase('some-aml-constant')).toEqual('Some AML constant')
    expect(humanizeKebabCase('aml-as-first-word')).toEqual('AML as first word')
    expect(humanizeKebabCase('aml')).toEqual('AML')
  })
  test('kebab case', () => {
    expect(humanizeSnakeCase('some_constant')).toEqual('Some constant')
    expect(humanizeSnakeCase('some_aml_constant')).toEqual('Some AML constant')
    expect(humanizeSnakeCase('aml_as_first_word')).toEqual('AML as first word')
    expect(humanizeSnakeCase('aml')).toEqual('AML')
  })
  test('constant case', () => {
    expect(humanizeConstant('SOME_CONSTANT')).toEqual('Some constant')
    expect(humanizeConstant('SOME_AML_CONSTANT')).toEqual('Some AML constant')
    expect(humanizeConstant('AML_AS_FIRST_WORD')).toEqual('AML as first word')
    expect(humanizeConstant('AML')).toEqual('AML')
  })
})

describe('recognize case', () => {
  test('snake case', () => {
    expect(recognizeCase('some_property_name')).toEqual('SNAKE_CASE')
    expect(recognizeCase('some_property_name42')).toEqual('SNAKE_CASE')
    expect(recognizeCase('some_Property_name')).toEqual('UNKNOWN')
    expect(recognizeCase('_some_property_name')).toEqual('UNKNOWN')
    expect(recognizeCase(' some_property_name')).toEqual('UNKNOWN')
  })

  test('camel case', () => {
    expect(recognizeCase('SomePropertyName')).toEqual('CAMEL_CASE')
    expect(recognizeCase('SomePropertyName42')).toEqual('CAMEL_CASE')
    expect(recognizeCase('somePropertyName')).toEqual('CAMEL_CASE')
    expect(recognizeCase('somePropertyName42')).toEqual('CAMEL_CASE')
    expect(recognizeCase('someVIPProperty')).toEqual('CAMEL_CASE')
    expect(recognizeCase(' somePropertyName')).toEqual('UNKNOWN')
    expect(recognizeCase('someProperty_Name')).toEqual('UNKNOWN')
    expect(recognizeCase('someProperty_Name')).toEqual('UNKNOWN')
  })

  test('constant case', () => {
    expect(recognizeCase('SOME')).toEqual('CONSTANT')
    expect(recognizeCase('SOME_PROPERTY')).toEqual('CONSTANT')
    expect(recognizeCase('SOME_PROPERTY42')).toEqual('CONSTANT')
    expect(recognizeCase('SOME-PROPERTY')).toEqual('KEBAB')
    expect(recognizeCase('SOME_PROPERTY ')).toEqual('UNKNOWN')
    expect(recognizeCase(' SOME_PROPERTY')).toEqual('UNKNOWN')
  })

  test('kebab case', () => {
    expect(recognizeCase('some-property')).toEqual('KEBAB')
    expect(recognizeCase('some-other-property')).toEqual('KEBAB')
  })

  test('unknown case', () => {
    expect(recognizeCase('simple text')).toEqual('UNKNOWN')
    expect(recognizeCase('name')).toEqual('SNAKE_CASE')
    expect(recognizeCase('a')).toEqual('SNAKE_CASE')
  })
})
