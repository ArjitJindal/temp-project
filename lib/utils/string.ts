import * as levenshtein from 'fast-levenshtein'
import { compact } from 'lodash'
import { ACCENTS_MAP } from './accents'

export function getEditDistance(str1: string, str2: string): number {
  return levenshtein.get(str1, str2, { useCollator: true })
}

export function getEditDistancePercentage(str1: string, str2: string): number {
  return (getEditDistance(str1, str2) / str1.length) * 100
}
// Function to remove special charcters excluding '-'
export function sanitizeString(
  str: string,
  preserveSpaces = true,
  normalizeString = true
) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string')
  }
  const pattern = preserveSpaces ? /[^a-zA-Z0-9\s-]/g : /[^a-zA-Z0-9]/g
  const sanitized = normalizeString
    ? normalize(str).replace(pattern, '')
    : str.replace(pattern, '')

  return preserveSpaces ? sanitized.replace(/\s+/g, ' ').trim() : sanitized
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
