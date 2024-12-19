import { HAS_ITEMS_OPERATOR } from '../hasItems'

describe('array isNotNullOrEmpty', () => {
  test('returns false if checking for empty and the array has elements', async () => {
    const result = await HAS_ITEMS_OPERATOR.run(['abc', 'bca'], false)
    expect(result).toBe(false)
  })

  test('return true if array is empty and checking for empty', async () => {
    const result = await HAS_ITEMS_OPERATOR.run([], false)
    expect(result).toBe(true)
  })

  test('return true if array is null and checking for null', async () => {
    const result = await HAS_ITEMS_OPERATOR.run(null, false)
    expect(result).toBe(true)
  })

  test('return true if array is undefined and checking for undefined', async () => {
    const result = await HAS_ITEMS_OPERATOR.run(undefined, false)
    expect(result).toBe(true)
  })

  test('returns true if checking for not empty and the array has elements', async () => {
    const result = await HAS_ITEMS_OPERATOR.run(['abc', 'bca'], true)
    expect(result).toBe(true)
  })

  test('return false if array is empty and checking for not empty', async () => {
    const result = await HAS_ITEMS_OPERATOR.run([], true)
    expect(result).toBe(false)
  })

  test('return false if array is null and checking for not null', async () => {
    const result = await HAS_ITEMS_OPERATOR.run(null, true)
    expect(result).toBe(false)
  })

  test('return false if array is undefined and checking for not undefined', async () => {
    const result = await HAS_ITEMS_OPERATOR.run(undefined, true)
    expect(result).toBe(false)
  })
})
