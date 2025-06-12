import * as levenshtein from 'fast-levenshtein'
import { compact } from 'lodash'
import { ACCENTS_MAP } from './accents'

export function getEditDistance(str1: string, str2: string): number {
  return levenshtein.get(str1, str2, { useCollator: true })
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

// Function to remove special characters
export function sanitizeString(
  str: string,
  preserveSpaces = true,
  normalizeString = true
) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string')
  }

  const sanitizePattern = preserveSpaces ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z0-9]/g // Pattern to remove unwanted characters

  let processed = normalizeString ? normalize(str) : str
  processed = replaceRequiredCharactersWithSpace(processed).replace(
    sanitizePattern,
    ''
  )

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
