import { DATE_TO_TIMESTAMP } from '../date-to-timestamp'
import dayjs from '@/utils/dayjs'

describe('date-to-timestamp function', () => {
  it('should convert date to timestamp', async () => {
    const testDate = '2024-01-01'
    const result = await DATE_TO_TIMESTAMP.run([testDate])
    expect(result).toBe(dayjs(testDate).unix() * 1000)
  })
  it('should show error if the date is not valid format', async () => {
    const result = await DATE_TO_TIMESTAMP.run(['not-a-date'])
    expect(result).toBeNaN()
  })
  it('should show error if the date is null', async () => {
    const result = await DATE_TO_TIMESTAMP.run([null])
    expect(result).toBe(0)
  })
  it('should show error if the date is undefined', async () => {
    const result = await DATE_TO_TIMESTAMP.run([undefined])
    expect(result).toBe(0)
  })
})
