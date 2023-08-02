import _ from 'lodash';
import { neverReturn } from '@/utils/lang';

/*
  SOME_CONSTANT_NAME => Some constant name
 */
export function humanizeConstant(name: string): string {
  return _.capitalize(_.toLower(name.split('_').join(' ')));
}

/*
  bank_smart_iban => Bank smart iban
 */
export function humanizeSnakeCase(name: string): string {
  return _.capitalize(_.toLower(name.split('_').join(' ')));
}

/*
  BankSmartIBAN => Bank smart IBAN
 */
export function humanizeCamelCase(name: string): string {
  return name
    .replace(/([A-Z])([A-Z])([a-z])/g, '$1 $2$3')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/( [A-Z])([a-z])/g, (v, g1, g2) => g1.toLowerCase() + g2)
    .replace(/^[a-z]/, (v) => v.toUpperCase());
}

export function humanizeAuto(value: string): string {
  const caseType = recognizeCase(value);
  switch (caseType) {
    case 'CAMEL_CASE':
      return humanizeCamelCase(value);
    case 'SNAKE_CASE':
      return humanizeSnakeCase(value);
    case 'CONSTANT':
      return humanizeConstant(value);
    case 'UNKNOWN':
      return value;
  }
  return neverReturn(caseType, value);
}

export function humanizeStrings(items: string[]): string {
  return items.reduce((acc, x, i) => {
    if (acc === '') {
      return x;
    }
    const isLastItem = i === items.length - 1;
    return acc + (isLastItem ? ' and ' : ', ') + x;
  }, '');
}

export function recognizeCase(
  string: string,
): 'CAMEL_CASE' | 'SNAKE_CASE' | 'CONSTANT' | 'UNKNOWN' {
  const isSnakeCase = string.match(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
  const isCamelCase = string.match(/^([A-Z]*[a-z0-9]+)+$/);
  const isConstant = string.match(/^[A-Z0-9]+(_[A-Z0-9]+)*$/);
  // If more than one match consider case unknown
  if ([isSnakeCase, isCamelCase, isConstant].filter(Boolean).length > 1) {
    return 'UNKNOWN';
  }
  if (isSnakeCase) {
    return 'SNAKE_CASE';
  }
  if (isCamelCase) {
    return 'CAMEL_CASE';
  }
  if (isConstant) {
    return 'CONSTANT';
  }
  return 'UNKNOWN';
}

export function firstLetterLower(str: string): string {
  if (str.length < 1) {
    return str;
  }
  return str[0].toLocaleLowerCase() + str.substring(1);
}

export function firstLetterUpper(str: string): string {
  if (str.length < 1) {
    return str;
  }
  return str[0].toUpperCase() + str.substring(1);
}

/*
  "Some Property with ABREVIATION Inside" -> "Some property with ABREVIATION inside"
 */
export function normalizeCase(str: string): string {
  return firstLetterUpper(str.replace(/([A-Z][a-z])/g, (x) => x.toLowerCase()));
}
