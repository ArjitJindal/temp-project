import { token_similarity_sort_ratio } from '../fuzzball'
import { calculateLevenshteinDistancePercentage } from '../search'

describe('token_similarity_sort_ratio', () => {
  it('should return the correct result', () => {
    expect(
      token_similarity_sort_ratio('abdul ali aziz', 'abdul mutalib aziz')
    ).toBe(
      calculateLevenshteinDistancePercentage('abdulaliaziz', 'abdulmutalibaziz')
    )
    expect(token_similarity_sort_ratio('John Doe', 'John Smith')).toBe(
      calculateLevenshteinDistancePercentage('JohnDoe', 'JohnSmith')
    )
    expect(token_similarity_sort_ratio('Smit Jon', 'John Smith')).toBe(
      calculateLevenshteinDistancePercentage('JonSmit', 'JohnSmith')
    )
    expect(
      token_similarity_sort_ratio('John Smith Deo', 'John Deo Smith')
    ).toBe(
      calculateLevenshteinDistancePercentage('JohnSmithDeo', 'JohnSmithDeo')
    )
    expect(
      token_similarity_sort_ratio(
        'Abdul Ali Abdul Aziz',
        'Kadir Abdul Ali Azizul Khan'
      )
    ).toBe(
      calculateLevenshteinDistancePercentage(
        'AbdulAliAziz',
        'AbdulAliAzizulKadirKhan'
      )
    )
  })
})
