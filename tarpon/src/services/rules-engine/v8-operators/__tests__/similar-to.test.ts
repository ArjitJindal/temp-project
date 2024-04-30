import { SIMILAR_TO_OPERATOR } from '../similar-to'

describe('similar to operator (single)', () => {
  test('within threshold', async () => {
    const result = await SIMILAR_TO_OPERATOR.run('apple', 'appl', [20])
    expect(result).toBe(true)
  })
  test('not within threshold', async () => {
    const result = await SIMILAR_TO_OPERATOR.run('apple', 'appl', [19])
    expect(result).toBe(false)
  })
})

describe('similar to operator (list)', () => {
  test('within threshold', async () => {
    const result = await SIMILAR_TO_OPERATOR.run('apple', ['appl'], [20])
    expect(result).toBe(true)
  })
  test('not within threshold', async () => {
    const result = await SIMILAR_TO_OPERATOR.run('apple', ['appl'], [19])
    expect(result).toBe(false)
  })
  test('within threshold (multiple)', async () => {
    const result = await SIMILAR_TO_OPERATOR.run(
      'apple',
      ['banana', 'appl'],
      [20]
    )
    expect(result).toBe(true)
  })
  test('not within threshold (multiple)', async () => {
    const result = await SIMILAR_TO_OPERATOR.run(
      'apple',
      ['banana', 'orange'],
      [19]
    )
    expect(result).toBe(false)
  })
  test('within threshold (exact match)', async () => {
    const result = await SIMILAR_TO_OPERATOR.run('apple', ['apple'], [0])
    expect(result).toBe(true)
  })
  test('not within threshold (completely different)', async () => {
    const result = await SIMILAR_TO_OPERATOR.run('apple', ['dog'], [0])
    expect(result).toBe(false)
  })
})
