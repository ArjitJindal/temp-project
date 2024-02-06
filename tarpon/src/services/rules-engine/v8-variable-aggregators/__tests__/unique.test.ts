import { UNIQUE_COUNT, UNIQUE_VALUES } from '../unique'

describe('UNIQUE_VALUES', () => {
  test('init', async () => {
    expect(UNIQUE_VALUES.init()).toEqual([])
  })
  test('aggregate', async () => {
    expect(UNIQUE_VALUES.aggregate(['a', 'a', 'b', 'b', 'c'])).toEqual([
      'a',
      'b',
      'c',
    ])
  })
  test('reduce', async () => {
    expect(UNIQUE_VALUES.reduce(['a', 'b'], 'b')).toEqual(['a', 'b'])
    expect(UNIQUE_VALUES.reduce(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
  })
  test('merge', async () => {
    expect(UNIQUE_VALUES.merge(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(UNIQUE_VALUES.merge(['a', 'b'], ['c', 'd'])).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })
  test('compute', async () => {
    expect(UNIQUE_VALUES.compute(['a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('UNIQUE_COUNT', () => {
  test('compute', async () => {
    expect(UNIQUE_COUNT.compute(['a', 'b'])).toEqual(2)
  })
})
