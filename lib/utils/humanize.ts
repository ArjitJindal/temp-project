import { startCase, toLower } from 'lodash'
import { ACRONYMS, isValidAcronyms } from '../constants/acronyms'

/*
  SOME_CONSTANT_NAME => Some constant name
 */
export function humanizeConstant(name: string): string {
  return humanizeSnakeCase(toLower(name))
}

/*
  bank_smart_iban => Bank smart iban
 */
export function humanizeSnakeCase(name: string): string {
  return firstLetterUpper(
    toLower(name)
      .split('_')
      .map((x) =>
        ACRONYMS.includes(x.toUpperCase()) ? x.toLocaleUpperCase() : x
      )
      .join(' ')
  )
}

/*
  bank-smart-iban => Bank smart iban
 */
export function humanizeKebabCase(value: string): string {
  return firstLetterUpper(
    value
      .split('-')
      .map((x) =>
        ACRONYMS.includes(x.toUpperCase()) ? x.toLocaleUpperCase() : x
      )
      .join(' ')
  )
}

/*
  BankSmartIBAN => Bank smart IBAN
 */
export function humanizeCamelCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert space before uppercase letters preceded by lowercase letters
    .replace(/([A-Z])([A-Z])([a-z])/g, '$1 $2$3') // Insert space between consecutive uppercase letters followed by a lowercase letter
    .replace(/( [A-Z])([a-z])/g, (v, g1, g2) => g1.toLowerCase() + g2) // Convert uppercase letter to lowercase if preceded by a space
    .replace(/^[a-z]/, (v) => v.toUpperCase()) // Capitalize the first letter of the string
    .split(/\s+/)
    .map((x) => (ACRONYMS.includes(x.toUpperCase()) ? x.toUpperCase() : x))
    .join(' ')
}

export function humanizeAuto(value: string): string {
  if (isValidAcronyms(value)) {
    return value
  }
  const caseType = recognizeCase(value)
  switch (caseType) {
    case 'CAMEL_CASE':
      return humanizeCamelCase(value)
    case 'SNAKE_CASE':
      return humanizeSnakeCase(value)
    case 'CONSTANT':
      return humanizeConstant(value)
    case 'KEBAB':
      return humanizeKebabCase(value)
    case 'UNKNOWN':
      return value
  }
}

export function humanizeStrings(items: string[]): string {
  return items.reduce((acc, x, i) => {
    if (acc === '') {
      return x
    }
    const isLastItem = i === items.length - 1
    return acc + (isLastItem ? ' and ' : ', ') + x
  }, '')
}

export function recognizeCase(
  string: string
): 'CAMEL_CASE' | 'SNAKE_CASE' | 'CONSTANT' | 'UNKNOWN' | 'KEBAB' {
  const isSnakeCase = string.match(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  const isCamelCase = string.match(/^([A-Z]*[a-z0-9]+)+$/)
  const isConstant = string.match(/^[A-Z0-9]+(_[A-Z0-9]+)*$/)
  const isKebab = string.match(/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/)
  if (isSnakeCase) {
    return 'SNAKE_CASE'
  }
  if (isCamelCase) {
    return 'CAMEL_CASE'
  }
  if (isConstant) {
    return 'CONSTANT'
  }
  if (isKebab) {
    return 'KEBAB'
  }
  return 'UNKNOWN'
}

export function firstLetterLower(str: string): string {
  if (str.length < 1) {
    return str
  }
  return str[0].toLocaleLowerCase() + str.substring(1)
}

export function firstLetterUpper(str?: string): string {
  if (!str) {
    return ''
  }
  if (str.length < 1) {
    return str
  }
  return str[0].toUpperCase() + str.substring(1)
}

/*
  "Some Property with ABREVIATION Inside" -> "Some property with ABREVIATION inside"
 */
export function normalizeCase(str: string): string {
  return firstLetterUpper(str.replace(/([A-Z][a-z])/g, (x) => x.toLowerCase()))
}

export function capitalizeWords(text: string): string {
  return startCase(toLower(text))
}
