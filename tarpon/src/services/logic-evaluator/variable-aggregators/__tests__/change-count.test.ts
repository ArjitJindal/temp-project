import { CHANGE_COUNT } from '../change-count'

describe('CHANGE_COUNT', () => {
  test('init', async () => {
    expect(CHANGE_COUNT.init()).toEqual({ first: null, last: null, count: 0 })
  })
  test('aggregate', async () => {
    expect(CHANGE_COUNT.aggregate([1, 2, 3])).toEqual({
      first: 1,
      last: 3,
      count: 2,
    })
  })
  test('reduce', async () => {
    expect(CHANGE_COUNT.reduce({ first: 1, last: 2, count: 1 }, [10])).toEqual({
      first: 1,
      last: 10,
      count: 2,
    })
  })
  test('merge', async () => {
    expect(
      CHANGE_COUNT.merge(
        { first: 1, last: 2, count: 3 },
        { first: 1, last: 3, count: 3 }
      )
    ).toEqual({
      first: 1,
      last: 3,
      count: 7,
    })
    expect(
      CHANGE_COUNT.merge(
        { first: 1, last: 2, count: 3 },
        { first: 2, last: 1, count: 3 }
      )
    ).toEqual({
      first: 1,
      last: 1,
      count: 6,
    })
    expect(
      CHANGE_COUNT.merge(
        { first: 'a', last: 'b', count: 3 },
        { first: 'c', last: 'a', count: 3 }
      )
    ).toEqual({
      first: 'a',
      last: 'a',
      count: 7,
    })
    expect(
      CHANGE_COUNT.merge(
        { first: 'a', last: 'b', count: 3 },
        { first: 'b', last: 'a', count: 3 }
      )
    ).toEqual({
      first: 'a',
      last: 'a',
      count: 6,
    })
  })
  test('compute', async () => {
    expect(CHANGE_COUNT.compute({ first: 1, last: 10, count: 3 })).toEqual(3)
  })
})
