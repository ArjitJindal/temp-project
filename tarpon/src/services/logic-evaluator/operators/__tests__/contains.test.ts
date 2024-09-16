import { CONTAINS_OPERATOR } from '../contains'

describe('contains (string)', () => {
  test('returns true if the value is present in the target', async () => {
    const result = await CONTAINS_OPERATOR.run('abc', 'a')
    expect(result).toBe(true)
  })

  test('return false if the value is present in the target', async () => {
    const result = await CONTAINS_OPERATOR.run('abc', 'd')
    expect(result).toBe(false)
  })
})

describe('contains (list)', () => {
  test('should return true if the value is present in the array', async () => {
    const blacklist = ['a', 'b', 'c']
    const value = 'b'

    const result = await CONTAINS_OPERATOR.run(value, blacklist)
    expect(result).toBe(true)
  })

  test('should return false if the value is not present in the array', async () => {
    const blacklist = ['a', 'b', 'c']
    const value = 'd'

    const result = await CONTAINS_OPERATOR.run(value, blacklist)

    expect(result).toBe(false)
  })

  test('should match substring', async () => {
    const blacklist = ['Mobiwik', 'Paytm']
    const value = 'Paytm Wallet'

    const result = await CONTAINS_OPERATOR.run(value, blacklist)

    expect(result).toBe(true)
  })

  test('checks for null values', async () => {
    const blacklist = ['a', 'b', 'c']
    const value = null

    const result = await CONTAINS_OPERATOR.run(value, blacklist)

    expect(result).toBe(false)
  })

  test('checks for undefined values', async () => {
    const blacklist = ['a', 'b', 'c']
    const value = undefined

    const result = await CONTAINS_OPERATOR.run(value, blacklist)

    expect(result).toBe(false)
  })

  test('checks for empty array', async () => {
    const blacklist = []
    const value = 'a'

    const result = await CONTAINS_OPERATOR.run(value, blacklist)

    expect(result).toBe(false)
  })
})
