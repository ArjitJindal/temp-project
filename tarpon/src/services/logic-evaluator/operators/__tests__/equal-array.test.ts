import { EQUAL_ARRAY_OPERATOR } from '../equal-array'

describe('array isNotNullOrEmpty', () => {
  test('returns true if both arrays are equal', async () => {
    const result = await EQUAL_ARRAY_OPERATOR.run(
      ['abc', 'bca'],
      ['abc', 'bca']
    )
    expect(result).toBe(true)
  })

  test('returns false if size mismatch', async () => {
    const result = await EQUAL_ARRAY_OPERATOR.run(
      ['abc', 'bca'],
      ['abc', 'bca', 'cda']
    )
    expect(result).toBe(false)
  })

  test('returns false if elements mismatch', async () => {
    const result = await EQUAL_ARRAY_OPERATOR.run(
      ['abc', 'bca'],
      ['abc', 'cda']
    )
    expect(result).toBe(false)
  })

  test('returns true if both arrays are empty as they are equal arrays', async () => {
    const result = await EQUAL_ARRAY_OPERATOR.run([], [])
    expect(result).toBe(true)
  })
})
