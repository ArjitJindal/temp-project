import { SIMILAR_TO_WORDS_OPERATOR } from '../similar-to-words'

describe('similar to (string)', () => {
  test('within threshold', async () => {
    const result = await SIMILAR_TO_WORDS_OPERATOR.run(
      'apple cable TABLE',
      'appl',
      [20]
    )
    expect(result).toBe(true)
  })

  test('not within threshold', async () => {
    const result = await SIMILAR_TO_WORDS_OPERATOR.run(
      'apple cable TABLE',
      'appl',
      [19]
    )
    expect(result).toBe(false)
  })
})

describe('similar to (list))', () => {
  test('within threshold', async () => {
    const result = await SIMILAR_TO_WORDS_OPERATOR.run(
      'apple cable TABLE',
      ['appl'],
      [20]
    )
    expect(result).toBe(true)
  })

  test('not within threshold', async () => {
    const result = await SIMILAR_TO_WORDS_OPERATOR.run(
      'apple cable TABLE',
      ['appl'],
      [19]
    )
    expect(result).toBe(false)
  })

  test('within threshold (exact match)', async () => {
    const result = await SIMILAR_TO_WORDS_OPERATOR.run(
      'apple bananana',
      ['apple'],
      [0]
    )
    expect(result).toBe(true)
  })
})
