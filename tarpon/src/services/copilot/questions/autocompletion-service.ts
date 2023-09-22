import { questions } from '@/services/copilot/questions/definitions'

const MAX_DISTANCE = 2
const LIMIT = 10
export class AutocompleteService {
  private phrases: string[] = questions.map((q) => q.questionId)

  autocomplete(query: string): string[] {
    const prefixResults: string[] = []
    const results: { phrase: string; distance: number }[] = []

    for (const phrase of this.phrases) {
      const words = phrase.split(' ')

      if (words.some((word) => word.startsWith(query))) {
        prefixResults.push(phrase)
      } else {
        const minDistance = Math.min(
          ...words.map((word) => this.calculateLevenshteinDistance(query, word))
        )

        if (minDistance <= MAX_DISTANCE) {
          results.push({ phrase, distance: minDistance })
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
    return combinedResults.slice(0, LIMIT)
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
