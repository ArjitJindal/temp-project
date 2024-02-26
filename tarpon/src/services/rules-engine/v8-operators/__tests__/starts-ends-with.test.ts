import { ENDS_WITH_OPERATOR, STARTS_WITH_OPERATOR } from '../starts-ends-with'

describe('starts with operator', () => {
  test('not starts with', async () => {
    const result = await STARTS_WITH_OPERATOR.run('apple', ['pp', 'pl', 'le'])
    expect(result).toBe(false)
  })
  test('stars with (1 match)', async () => {
    const result = await STARTS_WITH_OPERATOR.run('apple', ['pp', 'app', 'le'])
    expect(result).toBe(true)
  })
  test('stars with (all match)', async () => {
    const result = await STARTS_WITH_OPERATOR.run('apple', ['ap', 'app'])
    expect(result).toBe(true)
  })
})

describe('ends with operator', () => {
  test('not ends with', async () => {
    const result = await ENDS_WITH_OPERATOR.run('apple', ['pp', 'pl', 'ap'])
    expect(result).toBe(false)
  })
  test('ends with (1 match)', async () => {
    const result = await ENDS_WITH_OPERATOR.run('apple', ['pple', 'app', 'pp'])
    expect(result).toBe(true)
  })
  test('ends with (all match)', async () => {
    const result = await ENDS_WITH_OPERATOR.run('apple', ['le', 'ple'])
    expect(result).toBe(true)
  })
})
