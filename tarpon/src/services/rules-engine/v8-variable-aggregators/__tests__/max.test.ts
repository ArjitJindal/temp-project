import { MAX } from '../max'

describe('MAX', () => {
  test('init', async () => {
    expect(MAX.init()).toEqual(Number.MIN_SAFE_INTEGER)
  })
  test('aggregate', async () => {
    expect(MAX.aggregate([1, 2, 3])).toEqual(3)
  })
  test('reduce', async () => {
    expect(MAX.reduce(3, 2)).toEqual(3)
  })
  test('merge', async () => {
    expect(MAX.merge(1, 2)).toEqual(2)
  })
  test('compute', async () => {
    expect(MAX.compute(1)).toEqual(1)
  })
})
