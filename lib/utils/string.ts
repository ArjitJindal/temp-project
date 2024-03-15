import * as levenshtein from 'fast-levenshtein'

export function getEditDistance(str1: string, str2: string): number {
  return levenshtein.get(str1, str2, { useCollator: true })
}

export function getEditDistancePercentage(str1: string, str2: string): number {
  return (getEditDistance(str1, str2) / str1.length) * 100
}
