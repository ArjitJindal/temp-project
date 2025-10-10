import { TRUNCATE_DECIMAL } from '../truncate-decimals'

describe('truncate-decimal function', () => {
  it('should truncate decimal', async () => {
    const x = 123.123
    const result = await TRUNCATE_DECIMAL.run([x])
    expect(result).toEqual(123)
  })

  it('should truncate decimal', async () => {
    const x = 0.123
    const result = await TRUNCATE_DECIMAL.run([x])
    expect(result).toEqual(0)
  })

  it('should not truncate decimal', async () => {
    const x = 123
    const result = await TRUNCATE_DECIMAL.run([x])
    expect(result).toEqual(123)
  })
})
