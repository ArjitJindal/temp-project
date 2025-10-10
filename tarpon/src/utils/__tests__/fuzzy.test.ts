import {
  token_similarity_sort_ratio,
  calculateJaroWinklerDistance,
  fuzzyEarlyTermination,
  jaro_winkler_distance,
  fuzzy_levenshtein_distance,
} from '../fuzzy'
import { calculateLevenshteinDistancePercentage } from '../search'

describe('token_similarity_sort_ratio', () => {
  it('should return the correct result', () => {
    expect(
      token_similarity_sort_ratio('abdul ali aziz', 'abdul mutalib aziz', {
        partialMatch: false,
        partialMatchLength: 3,
        omitSpaces: true,
        fuzzinessThreshold: 100,
      })
    ).toBe(
      calculateLevenshteinDistancePercentage('abdulaliaziz', 'abdulmutalibaziz')
    )
    expect(
      token_similarity_sort_ratio('John Doe', 'John Smith', {
        partialMatch: false,
        partialMatchLength: 2,
        omitSpaces: true,
        fuzzinessThreshold: 100,
      })
    ).toBe(calculateLevenshteinDistancePercentage('JohnDoe', 'JohnSmith'))
    expect(
      token_similarity_sort_ratio('Smit Jon', 'John Smith', {
        partialMatch: false,
        partialMatchLength: 2,
        omitSpaces: true,
        fuzzinessThreshold: 100,
      })
    ).toBe(calculateLevenshteinDistancePercentage('JonSmit', 'JohnSmith'))
    expect(
      token_similarity_sort_ratio('John Smith Deo', 'John Deo Smith', {
        partialMatch: false,
        partialMatchLength: 3,
        omitSpaces: true,
        fuzzinessThreshold: 100,
      })
    ).toBe(
      calculateLevenshteinDistancePercentage('JohnSmithDeo', 'JohnSmithDeo')
    )
    expect(
      token_similarity_sort_ratio(
        'Abdul Ali Abdul Aziz',
        'Kadir Abdul Ali Azizul Khan',
        {
          partialMatch: false,
          partialMatchLength: 4,
          omitSpaces: true,
          fuzzinessThreshold: 100,
        }
      )
    ).toBe(
      calculateLevenshteinDistancePercentage(
        'AbdulAliAziz',
        'AbdulAliAzizulKadirKhan'
      )
    )
    expect(
      token_similarity_sort_ratio('mohammad ohab', 'muhammad', {
        partialMatch: true,
        partialMatchLength: 2,
        omitSpaces: false,
        fuzzinessThreshold: 100,
      })
    ).toBe(calculateLevenshteinDistancePercentage('mohammadohab', 'muhammad'))
  })
})

describe('fuzzyEarlyTermination', () => {
  it('should return true if the strings are similar', () => {
    expect(fuzzyEarlyTermination('hello', 'world', 100)).toBe(false)
  })
  it('should return true if the strings are similar', () => {
    expect(fuzzyEarlyTermination('hello', 'hello', 0)).toBe(false)
  })
  it('should return true if the strings are similar', () => {
    expect(fuzzyEarlyTermination('hello', 'hello ', 10)).toBe(false)
  })
  it('should return true if the strings are similar', () => {
    expect(fuzzyEarlyTermination('hello iiiii', 'hello world force', 10)).toBe(
      true
    )
  })
})

describe('calculateJaroWinklerDistance', () => {
  it('should return 100 for identical strings', () => {
    expect(calculateJaroWinklerDistance('hello', 'hello')).toBe(100)
    expect(calculateJaroWinklerDistance('', '')).toBe(100)
  })

  it('should return 0 for completely different strings', () => {
    expect(calculateJaroWinklerDistance('abc', 'xyz')).toBe(0)
    expect(calculateJaroWinklerDistance('hello', 'world')).toBe(
      46.666666666666664
    )
  })

  it('should handle similar strings with high similarity', () => {
    expect(calculateJaroWinklerDistance('martha', 'marhta')).toBeGreaterThan(90)
    expect(calculateJaroWinklerDistance('dwayne', 'duane')).toBeGreaterThan(80)
  })

  it('should handle strings with common prefix', () => {
    expect(calculateJaroWinklerDistance('jones', 'johnson')).toBeGreaterThan(70)
    expect(calculateJaroWinklerDistance('andrew', 'andrea')).toBeGreaterThan(80)
  })

  it('should handle different length strings', () => {
    expect(calculateJaroWinklerDistance('hello', 'hell')).toBeGreaterThan(80)
    expect(calculateJaroWinklerDistance('test', 'testing')).toBeGreaterThan(70)
  })

  it('should handle case sensitivity', () => {
    expect(calculateJaroWinklerDistance('Hello', 'hello')).toBeLessThan(100)
    expect(calculateJaroWinklerDistance('TEST', 'test')).toBeLessThan(100)
  })

  it('should handle special characters and spaces', () => {
    expect(
      calculateJaroWinklerDistance('hello world', 'hello-world')
    ).toBeGreaterThan(80)
    expect(calculateJaroWinklerDistance('test@123', 'test123')).toBeGreaterThan(
      70
    )
  })

  it('should handle empty strings', () => {
    expect(calculateJaroWinklerDistance('', 'test')).toBe(0)
    expect(calculateJaroWinklerDistance('test', '')).toBe(0)
  })
})

describe('Phonetic Matching Integration', () => {
  const defaultOptions = {
    partialMatch: false,
    omitSpaces: false,
    partialMatchLength: 0,
    fuzzinessThreshold: 100,
    enablePhoneticMatching: true,
  }

  describe('jaro_winkler_distance with phonetic matching', () => {
    it('should handle phonetically similar names', () => {
      // Test with phonetically similar names
      const result = jaro_winkler_distance('Smith', 'Smyth', defaultOptions)
      // Should be higher than regular Jaro-Winkler due to Soundex match
      expect(result).toBeGreaterThan(90)

      const result2 = jaro_winkler_distance('Robert', 'Rupert', defaultOptions)
      expect(result2).toBeGreaterThan(85)
    })

    it('should handle phonetically different names', () => {
      const result = jaro_winkler_distance('Smith', 'Johnson', defaultOptions)
      // Should be lower due to both phonetic and spelling differences
      expect(result).toBeLessThan(50)
    })

    it('should work with partial matching', () => {
      const options = {
        ...defaultOptions,
        partialMatch: true,
        partialMatchLength: 2,
      }
      const result = jaro_winkler_distance(
        'Smith Jones',
        'Smyth Johnson',
        options
      )
      expect(result).toBeGreaterThan(85)
    })
  })

  describe('fuzzy_levenshtein_distance with phonetic matching', () => {
    it('should handle phonetically similar names', () => {
      const result = fuzzy_levenshtein_distance(
        'Smith',
        'Smyth',
        defaultOptions
      )
      // Should be higher than regular Levenshtein due to Soundex match
      expect(result).toBeGreaterThan(85)
    })

    it('should handle phonetically different names', () => {
      const result = fuzzy_levenshtein_distance(
        'Smith',
        'Johnson',
        defaultOptions
      )
      // Should be lower due to both phonetic and spelling differences
      expect(result).toBeLessThan(50)
    })

    it('should work with partial matching', () => {
      const options = {
        ...defaultOptions,
        partialMatch: true,
        partialMatchLength: 2,
      }
      const result = fuzzy_levenshtein_distance(
        'Smith Jones',
        'Smyth Johnson',
        options
      )
      expect(result).toBeGreaterThan(70)
    })
  })

  describe('token_similarity_sort_ratio with phonetic matching', () => {
    it('should handle phonetically similar names', () => {
      const result = token_similarity_sort_ratio(
        'Smith',
        'Smyth',
        defaultOptions
      )
      // Should be higher than regular token similarity due to Soundex match
      expect(result).toBeGreaterThan(85)
    })

    it('should handle phonetically different names', () => {
      const result = token_similarity_sort_ratio(
        'Smith',
        'Johnson',
        defaultOptions
      )
      // Should be lower due to both phonetic and spelling differences
      expect(result).toBeLessThan(50)
    })

    it('should work with partial matching', () => {
      const options = {
        ...defaultOptions,
        partialMatch: true,
        partialMatchLength: 2,
      }
      const result = token_similarity_sort_ratio(
        'Smith Jones',
        'Smyth Johnson',
        options
      )
      expect(result).toBeGreaterThan(70)
    })
  })

  describe('Combined functionality tests', () => {
    it('should handle common name variations', () => {
      const testCases = [
        ['Smith', 'Smyth'],
        ['John', 'Jon'],
        ['Robert', 'Rupert'],
        ['Michael', 'Mikhail'],
        ['Catherine', 'Katherine'],
      ]

      testCases.forEach(([name1, name2]) => {
        const jaroResult = jaro_winkler_distance(name1, name2, defaultOptions)
        const levenResult = fuzzy_levenshtein_distance(
          name1,
          name2,
          defaultOptions
        )
        const tokenResult = token_similarity_sort_ratio(
          name1,
          name2,
          defaultOptions
        )

        // All results should be relatively high for these similar names
        expect(jaroResult).toBeGreaterThan(80)
        expect(levenResult).toBeGreaterThan(75)
        expect(tokenResult).toBeGreaterThan(75)
      })
    })

    it('should handle dissimilar names consistently', () => {
      const testCases = [
        ['Smith', 'Johnson'],
        ['John', 'William'],
        ['Robert', 'Michael'],
        ['Catherine', 'Elizabeth'],
      ]

      testCases.forEach(([name1, name2]) => {
        const jaroResult = jaro_winkler_distance(name1, name2, defaultOptions)
        const levenResult = fuzzy_levenshtein_distance(
          name1,
          name2,
          defaultOptions
        )
        const tokenResult = token_similarity_sort_ratio(
          name1,
          name2,
          defaultOptions
        )

        // All results should be relatively low for these different names
        expect(jaroResult).toBeLessThan(70)
        expect(levenResult).toBeLessThan(70)
        expect(tokenResult).toBeLessThan(70)
      })
    })
  })
})
