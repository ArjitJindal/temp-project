import { intersection as intersectionFn, uniq } from 'lodash'
import { calculateLevenshteinDistancePercentage } from './search'

/**
 * Calculates similarity between two strings using token-based sorting and Levenshtein distance
 * 1. Tokenizes both strings and sorts tokens
 * 2. Orders token lists based on length and alphabetical order
 * 3. Applies similarity-based token sorting
 * 4. Returns final similarity percentage
 */
export function token_similarity_sort_ratio(str1: string, str2: string) {
  const tokens1 = unique_tokens(str1)
  const tokens2 = unique_tokens(str2)

  const sorted1 = tokens1.sort()
  const sorted2 = tokens2.sort()

  const orderedTokenLists = order_token_lists(str1, sorted1, str2, sorted2)
  const first = orderedTokenLists[0]
  const second = orderedTokenLists[1]
  const newSecond = token_similarity_sort(first, second)
  return calculateLevenshteinDistancePercentage(
    first.join(''),
    newSecond.join('')
  )
}

/**
 * Orders two token lists consistently based on specific criteria:
 * 1. List with fewer tokens comes first
 * 2. If equal token count, string with shorter length comes first
 * 3. If still equal, alphabetical order is used
 * Returns [shorter_list, longer_list]
 */
function order_token_lists(
  str1: string,
  tokens1: string[],
  str2: string,
  tokens2: string[]
) {
  // To keep consistent ordering, assume shortest number of tokens, then str.length,
  // is more significant, else fallback to sort alphabetacally
  let first = tokens1
  let second = tokens2

  if (tokens1.length > tokens2.length) {
    first = tokens2
    second = tokens1
  } else if (tokens1.length === tokens2.length) {
    if (str1.length > str2.length) {
      first = tokens2
      second = tokens1
    } else {
      const sortedStrings = [str1, str2].sort()
      if (sortedStrings[0] === str2) {
        first = tokens2
        second = tokens1
      }
    }
  }
  return [first, second]
}

/**
 * Sorts the second token list to maximize similarity with the first list
 * 1. Calculates character frequency maps for all tokens
 * 2. Computes cosine similarity between tokens
 * 3. Creates optimal token matching using similarity scores
 * 4. Returns reordered second token list
 */
function token_similarity_sort(sorted1: string[], sorted2: string[]) {
  const oldSorted2 = sorted2

  const charCounts1 = sorted1.reduce((acc, str) => {
    acc[str] = getCharacterCounts(str)
    return acc
  }, {})

  const charCounts2 = oldSorted2.reduce((acc, str) => {
    acc[str] = getCharacterCounts(str)
    return acc
  }, {})

  const similarityVector: {
    similarity: number
    coorinates: Record<number, number>
  }[] = []
  let i = 0

  while (oldSorted2.length && i < sorted1.length) {
    oldSorted2.map((x, j) => {
      similarityVector.push({
        similarity: cosineSim(charCounts1[sorted1[i]], charCounts2[x]),
        coorinates: [i, j],
      })
    })
    i++
  }

  similarityVector.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity
    }
    return (
      calculateLevenshteinDistancePercentage(
        sorted1[b.coorinates[0]],
        oldSorted2[b.coorinates[1]]
      ) -
      calculateLevenshteinDistancePercentage(
        sorted1[a.coorinates[0]],
        oldSorted2[a.coorinates[1]]
      )
    )
  })
  i = 0
  let j = 0
  const newSorted2: string[] = new Array(oldSorted2.length)
  const usedColumn = new Set<number>()
  const usedRow = new Set<number>()

  while (j < sorted1.length && i < similarityVector.length) {
    if (
      !usedRow.has(similarityVector[i].coorinates[0]) &&
      !usedColumn.has(similarityVector[i].coorinates[1])
    ) {
      usedRow.add(similarityVector[i].coorinates[0])
      usedColumn.add(similarityVector[i].coorinates[1])
      newSorted2[similarityVector[i].coorinates[0]] =
        oldSorted2[similarityVector[i].coorinates[1]]
      j++
    }
    i++
  }
  return newSorted2.concat(oldSorted2.filter((_, i) => !usedColumn.has(i)))
}

/**
 * Calculates cosine similarity between two vectors represented as character frequency maps
 * 1. Finds intersection of characters between vectors
 * 2. Computes dot product of frequencies
 * 3. Normalizes by vector magnitudes
 * Returns similarity score between 0 and 1
 */
function cosineSim(v1: Record<string, number>, v2: Record<string, number>) {
  const keysV1 = Object.keys(v1)
  const keysV2 = Object.keys(v2)

  const intersection = intersectionFn(keysV1, keysV2)

  const prods = intersection.map(function (x) {
    return v1[x] * v2[x]
  })
  const numerator = prods.reduce(function (acc, x) {
    return acc + x
  }, 0)

  const v1Prods = keysV1.map(function (x) {
    return Math.pow(v1[x], 2)
  })
  const v1sum = v1Prods.reduce(function (acc, x) {
    return acc + x
  }, 0)

  const v2Prods = keysV2.map(function (x) {
    return Math.pow(v2[x], 2)
  })
  const v2sum = v2Prods.reduce(function (acc, x) {
    return acc + x
  }, 0)
  const denominator = Math.sqrt(v1sum) * Math.sqrt(v2sum)
  return numerator / denominator
}

/**
 * Creates a frequency map of characters in a string
 * Handles special wildcard characters if specified in options
 * Returns object where keys are characters and values are their counts
 */
function getCharacterCounts(str: string) {
  const charArray = str.split('')

  const charCounts: Record<string, number> = {}
  for (let i = 0; i < charArray.length; i++) {
    const char = charArray[i]
    if (charCounts[char]) {
      charCounts[char] += 1
    } else {
      charCounts[char] = 1
    }
  }

  return charCounts
}

function unique_tokens(str: string) {
  return uniq(str.match(/\S+/g))
}
