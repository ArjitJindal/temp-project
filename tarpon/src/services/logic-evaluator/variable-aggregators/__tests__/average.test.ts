import { AVG } from '../average'

describe('AVG', () => {
  test('init', async () => {
    expect(AVG.init()).toEqual({ count: 0, value: 0 })
  })
  test('aggregate', async () => {
    expect(AVG.aggregate([1, 2, 3])).toEqual({ count: 3, value: 6 })
  })
  test('reduce', async () => {
    expect(AVG.reduce({ count: 2, value: 3 }, 10)).toEqual({
      count: 3,
      value: 13,
    })
  })
  test('merge', async () => {
    expect(AVG.merge({ count: 2, value: 3 }, { count: 4, value: 5 })).toEqual({
      count: 6,
      value: 8,
    })
  })
  test('compute', async () => {
    expect(AVG.compute({ count: 3, value: 6 })).toEqual(2)
  })
})
