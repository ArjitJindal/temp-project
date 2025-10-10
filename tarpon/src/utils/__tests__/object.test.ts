import { mergeEntities, uniqObjects } from '@/utils/object'

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

describe('uniqObjects', () => {
  test('should return empty array when input is empty', () => {
    const array: object[] = []
    expect(uniqObjects(array)).toStrictEqual([])
  })

  test('should return same array when no duplicates are present', () => {
    const array = [
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
    ]
    expect(uniqObjects(array)).toStrictEqual(array)
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
    expect(uniqObjects(array)).toStrictEqual(expected)
  })

  test('should consider objects with same keys but different values as unique', () => {
    const array = [
      { a: 1, b: 2 },
      { a: 2, b: 2 },
      { a: 1, b: 3 },
    ]
    expect(uniqObjects(array)).toStrictEqual(array)
  })
})
