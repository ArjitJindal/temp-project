import { CONCAT_STRING } from '../concat-string'

describe('count_of_array_of_items', () => {
  it('should return the concat of the array', async () => {
    const x = 'one'
    const y = 'two'
    const result = await CONCAT_STRING.run([x, y])
    expect(result).toEqual('one two')
    const x2 = 'three'
    const result2 = await CONCAT_STRING.run([x2, result])
    expect(result2).toEqual('three one two')
  })
  it('should return empty string for empty array for items', async () => {
    const x = ''
    const y = ''
    const result = await CONCAT_STRING.run([x, y])
    expect(result).toEqual('')
  })
  it('should return empty string for null array for items', async () => {
    const x = null
    const y = null
    const result = await CONCAT_STRING.run([x, y])
    expect(result).toEqual('')
  })
})
