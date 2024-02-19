import { getAllValuesByKey, replaceMagicKeyword } from '../object'

describe('replaceMagicKeyword', () => {
  test('should handle special characters in replacement', () => {
    const keyword = '__NAME__'
    const replacement = 'Alice$'
    const input = {
      name: 'John Doe',
      message: 'Hello __NAME__! Welcome to $location$.',
    }

    const expected = {
      name: 'John Doe',
      message: 'Hello Alice$! Welcome to $location$.',
    }

    expect(replaceMagicKeyword(input, keyword, replacement)).toEqual(expected)
  })

  test('should handle special characters in keyword', () => {
    const input = {
      name: 'John Doe',
      message: 'Hello __NAME__! Welcome to $location$.',
    }
    const keyword = '__NAME__'
    const replacement = 'Alice'
    const expected = {
      name: 'John Doe',
      message: 'Hello Alice! Welcome to $location$.',
    }

    expect(replaceMagicKeyword(input, keyword, replacement)).toEqual(expected)
  })

  test('should handle multiple replacements', () => {
    const keyword = '__NAME__'
    const replacement = 'Alice'
    const input = {
      name: 'John Doe',
      message: 'Hello __NAME__! Welcome to __NAME__.',
    }

    const expected = {
      name: 'John Doe',
      message: 'Hello Alice! Welcome to Alice.',
    }

    expect(replaceMagicKeyword(input, keyword, replacement)).toEqual(expected)
  })
})

describe('getAllValuesByKey', () => {
  test('should return an empty array when the object is empty', () => {
    const obj = {}
    const key = 'name'
    expect(getAllValuesByKey(key, obj)).toEqual([])
  })

  test('should return an empty array when the key is not present in the object', () => {
    const obj = { a: 1, b: 2, c: 3 }
    const key = 'name'
    expect(getAllValuesByKey(key, obj)).toEqual([])
  })

  test('should return an array of values when the key is present in the object', () => {
    const obj = { a: 1, b: 2, c: 3, name: 'John Doe' }
    const key = 'name'
    expect(getAllValuesByKey(key, obj)).toEqual(['John Doe'])
  })

  test('should return an array of values when the key is present in nested objects', () => {
    const obj = {
      a: 1,
      b: { c: { name: 'John Doe' } },
      d: { e: { f: { name: 'Jane Smith' } } },
    }
    const key = 'name'
    expect(getAllValuesByKey(key, obj)).toEqual(['John Doe', 'Jane Smith'])
  })

  test('should return an array of values when the key is present in arrays', () => {
    const obj = {
      a: [{ name: 'John Doe' }, { name: 'Jane Smith' }],
      b: [{ name: 'Alice' }, { name: 'Bob' }],
    }
    const key = 'name'
    expect(getAllValuesByKey(key, obj)).toEqual([
      'John Doe',
      'Jane Smith',
      'Alice',
      'Bob',
    ])
  })
})
