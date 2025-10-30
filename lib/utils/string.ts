import compact from 'lodash/compact'
import { distance } from 'fastest-levenshtein'
import { ACCENTS_MAP } from './accents'

export function getEditDistance(str1: string, str2: string): number {
  return distance(normalize(str1), normalize(str2))
}

export function getEditDistanceForNormalizedStrings(
  str1: string,
  str2: string
): number {
  return distance(str1, str2)
}

export function getEditDistancePercentage(str1: string, str2: string): number {
  return (getEditDistance(str1, str2) / str1.length) * 100
}

export function replaceRequiredCharactersWithSpace(
  str: string,
  mergeSpaces?: boolean
): string {
  const toSpacePattern = /[,\-_/|&~:;]/g
  return mergeSpaces
    ? str.replace(toSpacePattern, ' ').replace(/\s+/g, ' ')
    : str.replace(toSpacePattern, ' ')
}

const SPECIAL_CHARACTERS_WHICH_SEPARATES_TOKENS = [
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  '"',
  "'",
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '-',
  '/',
  '\\',
  '|',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '+',
  '=',
  '<',
  '>',
  '~',
  '`',
]

const SPECIAL_CHARS_SET = new Set(SPECIAL_CHARACTERS_WHICH_SEPARATES_TOKENS)

export function sanitizeStringWithSpecialCharactersForTokenization(
  str: string
) {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    result += SPECIAL_CHARS_SET.has(char) ? '_' : char
  }
  // replace all consecutive underscores with a single underscore
  result = result.replace(/_+/g, '_')
  // remove leading and trailing underscores for each word
  result = result
    .split(' ')
    .map((word) => word.replace(/^_+|_+$/g, ''))
    .filter((word) => word.length > 0)
    .join(' ')
  return result
}

// Function to remove special characters
export function sanitizeString(
  str: string,
  preserveSpaces = true,
  normalizeString = true,
  removeSpecialCharactersWithSpaces = true
) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string')
  }

  const sanitizePattern = preserveSpaces ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z0-9]/g // Pattern to remove unwanted characters

  let processed = normalizeString ? normalize(str) : str
  processed = removeSpecialCharactersWithSpaces
    ? replaceRequiredCharactersWithSpace(processed).replace(sanitizePattern, '')
    : processed.replace(sanitizePattern, '')

  if (preserveSpaces) {
    return processed.replace(/\s+/g, ' ').trim()
  } else {
    return processed.replace(/\s+/g, '')
  }
}

// Sanitizes role names, preserving spaces and underscores
export function sanitizeRoleName(str: string, preserveSpaces = true) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string')
  }

  const sanitizePattern = preserveSpaces ? /[^a-zA-Z0-9_\s]/g : /[^a-zA-Z0-9_]/g //allow alphabets, numbers and underscores
  const processed = str.replace(sanitizePattern, '')
  if (preserveSpaces) {
    return processed.replace(/\s+/g, ' ').trim()
  } else {
    return processed.replace(/\s+/g, '')
  }
}

export function normalize(str: string): string {
  let result = ''
  for (const char of str) {
    const normalizedChar = ACCENTS_MAP[char]
    if (normalizedChar) {
      result += normalizedChar
    } else {
      result += char
    }
  }
  return compact(result.toLowerCase().split(' ')).join(' ')
}

export function isLatinScript(str: string): boolean {
  return /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?\s]+$/.test(str)
}
