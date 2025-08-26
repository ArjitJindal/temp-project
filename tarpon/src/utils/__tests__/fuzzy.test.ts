import {
  token_similarity_sort_ratio,
  calculateJaroWinklerDistance,
  fuzzyEarlyTermination,
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
