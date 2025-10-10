import {
  getEditDistance,
  getEditDistanceForNormalizedStrings,
} from '@flagright/lib/utils'
import max from 'lodash/max'

export function calculateLevenshteinDistancePercentage(
  str1: string,
  str2: string
): number {
  const distance = getEditDistance(str1, str2)
  return getLevenshteinSimilarityPercentage(str1.length, str2.length, distance)
}

export function calculateLevenshteinDistancePercentageForNormalizedStrings(
  str1: string,
  str2: string
): number {
  const distance = getEditDistanceForNormalizedStrings(str1, str2)
  return getLevenshteinSimilarityPercentage(str1.length, str2.length, distance)
}

function getLevenshteinSimilarityPercentage(
  str1Length: number,
  str2Length: number,
  distance: number
): number {
  const maxLength = max<number>([str1Length, str2Length])
  if (maxLength == null) {
    return 0
  }

  const percentage = (1 - distance / maxLength) * 100
  return percentage
}

/**
 * Calculates the score of objects in an array based on a query and weights.
 * @template T - The type of objects in the array.
 * @description This function calculates the score of each object in the array based on a query and weights assigned to each object property.
 *              For each property, the function calculates the Levenshtein distance percentage between the query and the property value.
 *              If the property value is a string, the function also calculates the number of words exactly matching the query and adds it to the score.
 *              The function then returns an array of objects with their corresponding scores.
 * @param {T[]} array - The array of objects to score.
 * @param {string} query - The query string to compare against the object values.
 * @param {Partial<Record<keyof T, number>>} weightsObject - The weights assigned to each object property.
 * @param {Object} [options] - Optional parameters.
 * @param {number} [options.minimumThreshold] - The minimum threshold score for an object to be included in the result.
 * @returns {Array<{ object: T; percentage: number }>} - An array of objects with their corresponding scores.
 */

export const scoreObjects = <T extends object>(
  array: T[],
  query: string,
  weightsObject: Partial<Record<keyof T, number>>,
  options?: { minimumThreshold?: number }
): { object: T; percentage: number }[] => {
  return array.map((object) => {
    let weightsSum = 0
    let totalScore = 0
    const keys = Object.keys(weightsObject) as Array<keyof T>
    keys.forEach((key) => {
      const value = object[key]
      const weight = weightsObject[key] as number
      let score = 0
      if (typeof value === 'string') {
        score = calculateLevenshteinDistancePercentage(query, value)

        // get the number of words exactly matching the query
        const words = value.split(' ').map((word) => word.toLowerCase())
        const queryWords = query.split(' ').map((word) => word.toLowerCase())

        const matchingWords = words.filter((word) =>
          queryWords.some((q) => q === word)
        )

        if (matchingWords.length) {
          score += matchingWords.length * weight
          weightsSum += weight * 0.75 // increase the weight sum to give more importance to exact matches
        }
      } else if (typeof value === 'number') {
        score = value
      } else if (typeof value === 'boolean') {
        score = value ? 100 : 0
      } else if (
        typeof value === 'object' &&
        Array.isArray(value) &&
        value.length
      ) {
        score = max(
          value.map((v) =>
            calculateLevenshteinDistancePercentage(
              query,
              typeof v === 'string' ? v : JSON.stringify(v)
            )
          )
        ) as number
      }
      if (score < (options?.minimumThreshold ?? 0)) {
        return
      }
      weightsSum += weight
      totalScore += score * weight
    })

    if (weightsSum === 0) {
      return { object, percentage: 0 }
    }

    const percentage = totalScore / weightsSum

    return { object, percentage }
  })
}
