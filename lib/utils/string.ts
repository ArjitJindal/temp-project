import * as levenshtein from 'fast-levenshtein'

export function getEditDistance(str1: string, str2: string): number {
  return levenshtein.get(str1, str2, { useCollator: true })
}

export function getEditDistancePercentage(str1: string, str2: string): number {
  return (getEditDistance(str1, str2) / str1.length) * 100
}
// Function to remove special charcters excluding '-'
export function sanitizeString(str: string, preserveSpaces = true) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string')
  }
  const pattern = preserveSpaces ? /[^a-zA-Z0-9\s-]/g : /[^a-zA-Z0-9]/g
  const sanitized = str.replace(pattern, '')

  return preserveSpaces ? sanitized.replace(/\s+/g, ' ').trim() : sanitized
}
