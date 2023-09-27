import { uniq } from 'lodash'
import { questions } from '@/services/copilot/questions/definitions'

const MAX_DISTANCE = 2
const LIMIT = 30
export class AutocompleteService {
  private phrases: string[] = questions.map((q) => q.questionId.toLowerCase())

  autocomplete(query: string): string[] {
    query = query.toLowerCase()
    const prefixResults: string[] = []
    const results: { phrase: string; distance: number }[] = []

    for (const completePhrase of this.phrases) {
      for (const phrase of splitStringIntoSubstrings(completePhrase)) {
        const distance = this.calculateLevenshteinDistance(query, phrase)

        if (distance <= MAX_DISTANCE) {
          results.push({ phrase: completePhrase, distance })
        }

        if (phrase.includes(query)) {
          prefixResults.push(completePhrase)
        }
      }
    }

    prefixResults.sort() // Sort prefix results alphabetically
    results.sort((a, b) => a.distance - b.distance)

    // Combine prefix results and Levenshtein results up to the limit
    const combinedResults = [
      ...prefixResults,
      ...results.map((result) => result.phrase),
    ]

    // Repair casing
    return uniq(combinedResults)
      .slice(0, LIMIT)
      .map((r) => {
        return (
          questions.find((q) => q.questionId.toLowerCase() === r)?.questionId ||
          ''
        )
      })
  }

  private calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Deletion
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        )
      }
    }

    return matrix[a.length][b.length]
  }
}

export function splitStringIntoSubstrings(input: string): string[] {
  const words = input.split(' ')
  const substrings: string[] = []

  for (let i = 0; i < words.length; i++) {
    substrings.push(words.slice(i).join(' '), words.slice(0, i + 1).join(' '))
  }

  return substrings
}
