import { LOCAL_TIME_IN_HOUR } from '../local-time-in-hour'

describe('LOCAL_TIME_IN_HOUR', () => {
  describe('run', () => {
    it('returns correct hour for UTC timezone', async () => {
      const timestamp = 1704124200000
      const timezone = 'UTC'

      const result = await LOCAL_TIME_IN_HOUR.run([timestamp, timezone])

      expect(result).toBe(15)
    })

    it('returns correct hour for New York timezone', async () => {
      const timestamp = 1704124200000
      const timezone = 'America/New_York'

      const result = await LOCAL_TIME_IN_HOUR.run([timestamp, timezone])

      expect(result).toBe(10)
    })

    it('handles timezone with extra spaces', async () => {
      const timestamp = 1704124200000
      const timezone = 'UTC   '

      const result = await LOCAL_TIME_IN_HOUR.run([timestamp, timezone])

      expect(result).toBe(15)
    })

    it('returns correct hour across date boundaries', async () => {
      const timestamp = 1704153000000
      const timezone = 'Asia/Tokyo'

      const result = await LOCAL_TIME_IN_HOUR.run([timestamp, timezone])
      // as dayjs rounds it to ceil
      expect(result).toBe(8)
    })
  })
})
