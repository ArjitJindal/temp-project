import { TIMESTAMP_DIFF_SECONDS } from '../timestamp-diff-seconds'
import dayjs from '@/utils/dayjs'

describe('timestamp-diff-seconds function', () => {
  it('should calculate diff in seconds between two timestamps (t1 > t2) ', async () => {
    const t = dayjs()
    const result = await TIMESTAMP_DIFF_SECONDS.run([
      t.valueOf(),
      t.add(123, 'second').add(10, 'millisecond').valueOf(),
    ])
    expect(result).toBe(123)
  })
  it('should calculate diff in seconds between two timestamps (t2 > t1) ', async () => {
    const t = dayjs()
    const result = await TIMESTAMP_DIFF_SECONDS.run([
      t.add(123, 'second').valueOf(),
      t.valueOf(),
    ])
    expect(result).toBe(123)
  })
  it('should calculate diff in seconds between two timestamps (t1 = t2) ', async () => {
    const t = dayjs()
    const result = await TIMESTAMP_DIFF_SECONDS.run([t.valueOf(), t.valueOf()])
    expect(result).toBe(0)
  })
  it('should return NaN if the first argument is not a timestamp', async () => {
    const result = await TIMESTAMP_DIFF_SECONDS.run([
      'not-a-timestamp',
      dayjs().valueOf(),
    ])
    expect(result).toBeNaN()
  })
})
