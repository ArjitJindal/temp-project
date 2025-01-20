import { JobRunConfig, shouldRun } from '../sla-scheduler'
import dayjs from '@/utils/dayjs'
describe('HourBatchJobScheduler', () => {
  describe('Normal window (same day)', () => {
    // Window: 9AM to 5PM, every 3 hours, check every 5 minutes
    const config: JobRunConfig = {
      windowStart: 9,
      windowEnd: 17,
      runIntervalInHours: 3,
      checkCallInterval: 5,
    }

    test.each([
      ['2024-03-20 09:02', true], // First interval, within check window
      ['2024-03-20 09:07', false], // First interval, outside check window
      ['2024-03-20 12:00', true], // Second interval, exact time
      ['2024-03-20 12:04', true], // Second interval, within check window
      ['2024-03-20 15:03', true], // Third interval, within check window
      ['2024-03-20 15:06', false], // Third interval, outside check window
      ['2024-03-20 10:00', false], // Non-interval hour
      ['2024-03-20 08:59', false], // Just before window
      ['2024-03-20 17:01', false], // Just after window
    ])('should correctly schedule for time %s', (timeStr, expected) => {
      const time = dayjs(timeStr)
      expect(shouldRun(config, time)).toBe(expected)
    })
  })

  describe('Overnight window', () => {
    // Window: 11PM to 5AM, every 2 hours, check every 10 minutes
    const config: JobRunConfig = {
      windowStart: 23,
      windowEnd: 5,
      runIntervalInHours: 2,
      checkCallInterval: 10,
    }

    test.each([
      ['2024-03-20 23:07', true], // First run, within check window
      ['2024-03-20 23:11', false], // First run, outside check window
      ['2024-03-21 01:00', true], // Second run, exact time
      ['2024-03-21 01:09', true], // Second run, within check window
      ['2024-03-21 03:04', true], // Third run, within check window
      ['2024-03-21 05:00', false], // At window end
      ['2024-03-20 22:59', false], // Just before window
      ['2024-03-21 00:30', false], // Between intervals
      ['2024-03-21 05:01', false], // Just after window
    ])(
      'should correctly schedule for overnight time %s',
      (timeStr, expected) => {
        const time = dayjs(timeStr)
        expect(shouldRun(config, time)).toBe(expected)
      }
    )
  })

  describe('Edge cases and minute variations', () => {
    test('should throw error if check interval > 60 minutes', () => {
      expect(() => {
        const config: JobRunConfig = {
          windowStart: 9,
          windowEnd: 17,
          runIntervalInHours: 2,
          checkCallInterval: 61,
        }
        shouldRun(config, dayjs('2024-03-20 09:00'))
      }).toThrow('Calling of the fucntion should be less than a hour')
    })

    test('should handle different check intervals', () => {
      const config: JobRunConfig = {
        windowStart: 9,
        windowEnd: 17,
        runIntervalInHours: 2,
        checkCallInterval: 15,
      }

      // Test various times within and outside the 15-minute window
      expect(shouldRun(config, dayjs('2024-03-20 09:00'))).toBe(true)
      expect(shouldRun(config, dayjs('2024-03-20 09:14'))).toBe(true)
      expect(shouldRun(config, dayjs('2024-03-20 09:15'))).toBe(false)
      expect(shouldRun(config, dayjs('2024-03-20 09:45'))).toBe(false)
    })

    test('should handle window start equal to window end', () => {
      const config: JobRunConfig = {
        windowStart: 9,
        windowEnd: 9,
        runIntervalInHours: 2,
        checkCallInterval: 5,
      }
      expect(shouldRun(config, dayjs('2024-03-20 09:03'))).toBe(false)
    })
  })

  describe('Full day cycle with varied checks', () => {
    // Window: 8PM to 11AM, every 4 hours, check every 10 minutes
    const config: JobRunConfig = {
      windowStart: 20,
      windowEnd: 11,
      runIntervalInHours: 4,
      checkCallInterval: 10,
    }

    test.each([
      ['2024-03-20 20:03', true], // First run, slightly delayed
      ['2024-03-20 20:11', false], // Outside check window
      ['2024-03-21 00:08', true], // Midnight run, within window
      ['2024-03-21 04:00', true], // Exact time
      ['2024-03-21 08:07', true], // Early morning run
      ['2024-03-21 11:00', false], // Window end
      ['2024-03-20 19:59', false], // Just before window
      ['2024-03-21 11:01', false], // Just after window
      ['2024-03-21 02:00', false], // Non-interval hour
      ['2024-03-21 08:59', false], // Outside check window but within valid hour
    ])(
      'should correctly schedule for full cycle time %s',
      (timeStr, expected) => {
        const time = dayjs(timeStr)
        expect(shouldRun(config, time)).toBe(expected)
      }
    )
  })

  describe('Short window with frequent checks', () => {
    // Window: 2PM to 6PM, every 1 hour, check every 3 minutes
    const config: JobRunConfig = {
      windowStart: 14,
      windowEnd: 18,
      runIntervalInHours: 1,
      checkCallInterval: 3,
    }

    test.each([
      ['2024-03-20 14:02', true], // First hour, within check
      ['2024-03-20 15:00', true], // Exact hour
      ['2024-03-20 15:03', false], // Just outside check window
      ['2024-03-20 16:01', true], // Within check window
      ['2024-03-20 17:02', true], // Last valid hour
      ['2024-03-20 18:00', false], // Window end
    ])(
      'should correctly schedule for short window time %s',
      (timeStr, expected) => {
        const time = dayjs(timeStr)
        expect(shouldRun(config, time)).toBe(expected)
      }
    )
  })
})
