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

describe('UNIQUE_VALUES: numeric values', () => {
  test('init', async () => {
    expect(UNIQUE_VALUES.init()).toEqual([])
  })
  test('aggregate', async () => {
    expect(UNIQUE_VALUES.aggregate([1, 1, 2, 2, 3])).toEqual([1, 2, 3])
  })
  test('reduce', async () => {
    expect(UNIQUE_VALUES.reduce([1, 2], 2)).toEqual([1, 2])
    expect(UNIQUE_VALUES.reduce([1, 2], 3)).toEqual([1, 2, 3])
  })
  test('merge', async () => {
    expect(UNIQUE_VALUES.merge([1, 2], [2, 3])).toEqual([1, 2, 3])
    expect(UNIQUE_VALUES.merge([1, 2], [3, 4])).toEqual([1, 2, 3, 4])
  })
  test('compute', async () => {
    expect(UNIQUE_VALUES.compute([1, 2])).toEqual([1, 2])
  })
})

describe('UNIQUE_COUNT', () => {
  test('compute', async () => {
    expect(UNIQUE_COUNT.compute(['a', 'b'])).toEqual(2)
  })
  test('aggregate numeric', async () => {
    expect(UNIQUE_COUNT.aggregate([1.0, 1.2, 1.0])).toHaveLength(2)
    expect(UNIQUE_COUNT.aggregate([1.0, 1.2, 1.0])).toEqual([1.0, 1.2])
  })
  test('compute numeric', async () => {
    expect(UNIQUE_COUNT.compute([1.0, 1.2, 1.0])).toEqual(3)
  })
})
