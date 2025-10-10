import {
  NUMBER_TO_STRING,
  STRING_TO_NUMBER,
  STRING_TO_TIMESTAMP,
} from '../type-convertion'
import dayjs from '@/utils/dayjs'

describe('type-conversion function', () => {
  it('should convert number to string', async () => {
    const x = 123
    const result = await NUMBER_TO_STRING.run([x])
    expect(result).toEqual('123')
  })
  it('should convert number to string', async () => {
    const x = 123.123
    const result = await NUMBER_TO_STRING.run([x])
    expect(result).toEqual('123.123')
  })
})

describe('STRING_TO_NUMBER function', () => {
  it('should convert string to number', async () => {
    const str = '123'
    const result = await STRING_TO_NUMBER.run([str])
    expect(result).toEqual(123)
  })

  it('should convert string float to number', async () => {
    const str = '123.45'
    const result = await STRING_TO_NUMBER.run([str])
    expect(result).toEqual(123.45)
  })

  it('should return 0 for non-numeric string', async () => {
    const str = 'abc'
    const result = await STRING_TO_NUMBER.run([str])
    expect(result).toEqual(0)
  })

  it('should return 0 for empty string', async () => {
    const str = ''
    const result = await STRING_TO_NUMBER.run([str])
    expect(result).toEqual(0)
  })
})

describe('STRING_TO_TIMESTAMP function', () => {
  it('should convert string to timestamp', async () => {
    const timestamp = dayjs().unix() * 1000
    const str = String(timestamp)
    const result = await STRING_TO_TIMESTAMP.run([str])
    expect(result).toEqual(timestamp)
  })
})
