import { SUM } from '../sum'

describe('SUM', () => {
  test('init', async () => {
    expect(SUM.init()).toEqual(0)
  })
  test('aggregate', async () => {
    expect(SUM.aggregate([1, 2, 3])).toEqual(6)
  })
  test('reduce', async () => {
    expect(SUM.reduce(3, [2])).toEqual(5)
  })
  test('merge', async () => {
    expect(SUM.merge(1, 2)).toEqual(3)
  })
  test('compute', async () => {
    expect(SUM.compute(1)).toEqual(1)
  })
})
