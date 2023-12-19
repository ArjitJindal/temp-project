import {
  mergeEntities,
  dedupObjectArray,
  deleteUnwantedKeys,
} from '@/utils/object'

describe('mergeEntities', () => {
  test('array arent merged', async () => {
    const obj1: any = {
      name: 'Tim Coulson',
      tags: [{ a: 'va' }, { b: 'vb' }, { c: 'vc' }],
    }
    const obj2: any = {
      name: 'Aman Dugar',
      country: 'IN',
      tags: [{ d: 'vd' }, { e: 've' }],
    }

    expect(mergeEntities(obj1, obj2)).toStrictEqual({
      name: 'Aman Dugar',
      country: 'IN',
      tags: [{ d: 'vd' }, { e: 've' }],
    })
  })
  test('deep merge', async () => {
    const obj1: any = {
      a: { b: 1 },
      tags: [],
    }
    const obj2: any = {
      a: { c: 1 },
      tags: [1, 2],
    }

    expect(mergeEntities(obj1, obj2)).toStrictEqual({
      tags: [1, 2],
      a: { b: 1, c: 1 },
    })
  })
  test('shallow merge', async () => {
    const obj1: any = {
      a: { b: 1 },
      tags: [],
    }
    const obj2: any = {
      a: { c: 1 },
      tags: [1, 2],
    }

    expect(mergeEntities(obj1, obj2, false)).toStrictEqual({
      tags: [1, 2],
      a: { c: 1 },
    })
  })
  test('empty array replaces', async () => {
    const obj1: any = {
      somearray: [1, 2],
    }
    const obj2: any = {
      somearray: [],
    }

    expect(mergeEntities(obj1, obj2)).toStrictEqual({
      somearray: [],
    })
  })
})

describe('dedupObjectArray', () => {
  test('should return empty array when input is empty', () => {
    const array: object[] = []
    expect(dedupObjectArray(array)).toStrictEqual([])
  })

  test('should return same array when no duplicates are present', () => {
    const array = [
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
    ]
    expect(dedupObjectArray(array)).toStrictEqual(array)
  })

  test('should remove duplicate objects from array', () => {
    const array = [
      { a: 1, b: 2 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ]
    const expected = [
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ]
    expect(dedupObjectArray(array)).toStrictEqual(expected)
  })

  test('should consider objects with same keys but different values as unique', () => {
    const array = [
      { a: 1, b: 2 },
      { a: 2, b: 2 },
      { a: 1, b: 3 },
    ]
    expect(dedupObjectArray(array)).toStrictEqual(array)
  })
})

describe('deleteUnwantedKeys', () => {
  test('should delete specified keys from an object', () => {
    const obj = { a: 1, b: 2, c: 3 }
    deleteUnwantedKeys(obj, ['b', 'c'])
    expect(obj).toStrictEqual({ a: 1 })
  })

  test('should delete specified keys from nested objects', () => {
    const obj = { a: 1, b: { c: 2, d: 3 }, e: 4 }
    deleteUnwantedKeys(obj, ['c', 'e'])
    expect(obj).toStrictEqual({ a: 1, b: { d: 3 } })
  })

  test('should not delete keys beyond the specified max depth', () => {
    const obj = { a: 1, b: { c: { d: 4 } } }
    deleteUnwantedKeys(obj, ['d'], 2)
    expect(obj).toStrictEqual({ a: 1, b: { c: { d: 4 } } })
  })

  test('should delete specified keys from an array of objects', () => {
    const obj = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]
    deleteUnwantedKeys(obj, ['b'])
    expect(obj).toStrictEqual([{ a: 1 }, { a: 3 }])
  })

  test('should not delete keys if no keys are specified', () => {
    const obj = { a: 1, b: 2, c: 3 }
    deleteUnwantedKeys(obj)
    expect(obj).toStrictEqual({ a: 1, b: 2, c: 3 })
  })

  test('should not delete keys if the object is null', () => {
    const obj = null
    deleteUnwantedKeys(obj, ['a'])
    expect(obj).toBeNull()
  })

  test('should not delete keys beyond the specified max depth', () => {
    const obj = {
      total: 200,
      data: [
        {
          _id: '6578839de3cd6665bbaf9703',
          type: 'CONSUMER',
          krsScore: {
            krsScore: 66.24,
            PartitionKeyID: 'flagright#user#primary',
            SortKeyID: 'U-162',
          },
          drsScore: {
            drsScore: 30.3125,
            PartitionKeyID: 'flagright#user#primary',
            SortKeyID: 'U-162',
          },
          PartitionKeyID: 'flagright#user#primary',
          SortKeyID: 'U-162',
          userSegment: 'RETAIL',
          comments: [],
        },
      ],
    }

    deleteUnwantedKeys(obj, ['PartitionKeyID', 'SortKeyID'], 4)
    expect(obj).toStrictEqual({
      total: 200,
      data: [
        {
          _id: '6578839de3cd6665bbaf9703',
          type: 'CONSUMER',
          krsScore: {
            krsScore: 66.24,
          },
          drsScore: {
            drsScore: 30.3125,
          },
          userSegment: 'RETAIL',
          comments: [],
        },
      ],
    })
  })
})
