import { mergeEntities } from '@/utils/object'

describe('mergeEntities', () => {
  test('tags are replaced', async () => {
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
      tags: [1, 2],
    }
    const obj2: any = {
      a: { c: 1 },
      tags: [],
    }

    expect(mergeEntities(obj1, obj2)).toStrictEqual({
      tags: [],
      a: { b: 1, c: 1 },
    })
  })
})
