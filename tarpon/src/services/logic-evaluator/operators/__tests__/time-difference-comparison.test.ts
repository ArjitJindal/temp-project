import {
  TIME_DIFFERENCE_GREATER_THAN,
  TIME_DIFFERENCE_LESSER_THAN,
} from '../time-difference-comparison'

describe('Time Difference Comparison Operators', () => {
  describe('TIME_DIFFERENCE_GREATER_THAN', () => {
    it('should return true when time difference is greater than threshold', async () => {
      const now = Date.now()
      const thirtyMinutesAgo = now - 30 * 60 * 1000 // 30 minutes in milliseconds
      const result = await TIME_DIFFERENCE_GREATER_THAN.run(
        now,
        thirtyMinutesAgo,
        [600]
      ) // 600 seconds = 10 minutes
      expect(result).toBe(true)
    })

    it('should return false when time difference is less than threshold', async () => {
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000
      const result = await TIME_DIFFERENCE_GREATER_THAN.run(
        now,
        fiveMinutesAgo,
        [600]
      )
      expect(result).toBe(false)
    })
  })

  describe('TIME_DIFFERENCE_LESSER_THAN', () => {
    it('should return true when time difference is less than threshold', async () => {
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000
      const result = await TIME_DIFFERENCE_LESSER_THAN.run(
        now,
        fiveMinutesAgo,
        [600]
      )
      expect(result).toBe(true)
    })

    it('should return false when time difference is greater than threshold', async () => {
      const now = Date.now()
      const thirtyMinutesAgo = now - 30 * 60 * 1000
      const result = await TIME_DIFFERENCE_LESSER_THAN.run(
        now,
        thirtyMinutesAgo,
        [600]
      )
      expect(result).toBe(false)
    })
  })

  describe('Error cases', () => {
    it('should return false for non-finite timestamps', async () => {
      const result = await TIME_DIFFERENCE_GREATER_THAN.run(NaN, Date.now(), [
        600,
      ])
      expect(result).toBe(false)
    })

    it('should return false for non-finite threshold', async () => {
      const now = Date.now()
      const fiveMinutesAgo = now - 5 * 60 * 1000
      const result = await TIME_DIFFERENCE_GREATER_THAN.run(
        now,
        fiveMinutesAgo,
        [NaN]
      )
      expect(result).toBe(false)
    })

    it('should handle equal timestamps', async () => {
      const now = Date.now()
      const result = await TIME_DIFFERENCE_GREATER_THAN.run(now, now, [1])
      expect(result).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle exactly equal to threshold for greater than', async () => {
      const now = Date.now()
      const tenMinutesAgo = now - 10 * 60 * 1000
      const result = await TIME_DIFFERENCE_GREATER_THAN.run(
        now,
        tenMinutesAgo,
        [600]
      )
      expect(result).toBe(false) // Should be false because it needs to be strictly greater
    })

    it('should handle exactly equal to threshold for lesser than', async () => {
      const now = Date.now()
      const tenMinutesAgo = now - 10 * 60 * 1000
      const result = await TIME_DIFFERENCE_LESSER_THAN.run(now, tenMinutesAgo, [
        600,
      ])
      expect(result).toBe(false) // Should be flase because it's less than
    })
  })
})
