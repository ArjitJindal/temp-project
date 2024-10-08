import { COUNT } from '../count'

describe('COUNT', () => {
  test('init', async () => {
    expect(COUNT.init()).toEqual(0)
  })
  test('aggregate', async () => {
    expect(COUNT.aggregate([1, 2, 3])).toEqual(3)
  })
  test('reduce', async () => {
    expect(COUNT.reduce(3, ['dummy'])).toEqual(4)
  })
  test('merge', async () => {
    expect(COUNT.merge(1, 2)).toEqual(3)
  })
  test('compute', async () => {
    expect(COUNT.compute(1)).toEqual(1)
  })
})
