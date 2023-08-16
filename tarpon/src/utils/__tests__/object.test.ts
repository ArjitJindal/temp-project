import { mergeEntities } from '@/utils/object'

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
