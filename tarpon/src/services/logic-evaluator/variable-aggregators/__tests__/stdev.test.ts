import { STDEV } from '../stdev'

describe('STDEV', () => {
  test('init', async () => {
    expect(STDEV.init()).toEqual({ sumOfSquares: 0, count: 0, sum: 0 })
  })
  test('aggregate', async () => {
    expect(STDEV.aggregate([1, 2, 3])).toEqual({
      sumOfSquares: 14,
      count: 3,
      sum: 6,
    })
  })
  test('reduce', async () => {
    expect(STDEV.reduce({ sumOfSquares: 14, count: 3, sum: 6 }, [10])).toEqual({
      sumOfSquares: 114,
      count: 4,
      sum: 16,
    })
  })
  test('merge', async () => {
    expect(
      STDEV.merge(
        { sumOfSquares: 14, count: 3, sum: 6 },
        { sumOfSquares: 114, count: 4, sum: 16 }
      )
    ).toEqual({
      sumOfSquares: 128,
      count: 7,
      sum: 22,
    })
  })
  test('compute', async () => {
    expect(STDEV.compute({ sumOfSquares: 128, count: 7, sum: 22 })).toBeCloseTo(
      2.8997,
      4
    )
  })
})
