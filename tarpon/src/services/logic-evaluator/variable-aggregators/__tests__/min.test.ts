import { MIN } from '../min'

describe('MIN', () => {
  test('init', async () => {
    expect(MIN.init()).toEqual(Number.MAX_SAFE_INTEGER)
  })
  test('aggregate', async () => {
    expect(MIN.aggregate([1, 2, 3])).toEqual(1)
  })
  test('reduce', async () => {
    expect(MIN.reduce(3, [2])).toEqual(2)
  })
  test('merge', async () => {
    expect(MIN.merge(1, 2)).toEqual(1)
  })
  test('compute', async () => {
    expect(MIN.compute(1)).toEqual(1)
  })
})
