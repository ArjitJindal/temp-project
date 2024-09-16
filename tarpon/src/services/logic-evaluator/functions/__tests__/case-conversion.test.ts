import { LOWERCASE, UPPERCASE } from '../case-conversion'

describe('case-conversion function', () => {
  it('should convert string to lowercase', async () => {
    const str = 'HELLO'
    const result = await LOWERCASE.run([str])
    expect(result).toEqual('hello')
  })

  it('should convert string to uppercase', async () => {
    const str = 'hello'
    const result = await UPPERCASE.run([str])
    expect(result).toEqual('HELLO')
  })
})
