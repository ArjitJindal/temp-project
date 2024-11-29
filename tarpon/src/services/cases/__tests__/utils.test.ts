import { calculateCaseAvailableDate } from '../utils'
import dayjs, { Timezone } from '@/utils/dayjs'

const DEFAULT_TIMEZONE: Timezone = 'Etc/UTC'
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS Z'

describe('Case service utils', () => {
  describe('calculateCaseAvailableDate', () => {
    describe('INSTANTLY mode', () => {
      test('Always returns undefined', () => {
        const result = calculateCaseAvailableDate(
          0,
          {
            type: 'INSTANTLY',
          },
          DEFAULT_TIMEZONE
        )
        expect(result).toBeUndefined()
      })
    })

    describe('DAILY mode', () => {
      test('Day after today', () => {
        const now = '2023-06-01T12:00:00Z'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          { type: 'DAILY', time: '1' },
          DEFAULT_TIMEZONE
        )

        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-06-02 01:00:00.000 +00:00'
        )
      })

      test('Same day', () => {
        const now = '2023-06-01T12:00:00Z'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          { type: 'DAILY', time: '13' },
          DEFAULT_TIMEZONE
        )

        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-06-01 13:00:00.000 +00:00'
        )
      })

      test('Different timezone', () => {
        const now = '2023-06-01T12:00:00Z'
        const timezone = 'Europe/Berlin'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          { type: 'DAILY', time: '13' },
          timezone
        )

        expect(dayjs(result).tz(timezone).format(DATE_FORMAT)).toEqual(
          '2023-06-02 13:00:00.000 +02:00'
        )
      })
    })

    test('Under 24 hours', () => {
      const now = '2023-06-01T12:00:00Z'
      const timezone = 'Europe/Berlin'
      const result = calculateCaseAvailableDate(
        dayjs(now).valueOf(),
        { type: 'DAILY', time: '23' },
        timezone
      )
      expect(dayjs(result).tz(timezone).format(DATE_FORMAT)).toEqual(
        '2023-06-01 23:00:00.000 +02:00'
      )
    })

    describe('WEEKLY mode', () => {
      test('Day after today', () => {
        const now = '2023-06-01T12:00:00Z'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'WEEKLY',
            day: 'FRIDAY',
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-06-02 00:00:00.000 +00:00'
        )
      })
      test('The same day should move to the next week', () => {
        const now = '2023-06-01T12:00:00Z'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'WEEKLY',
            day: 'THURSDAY',
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-06-08 00:00:00.000 +00:00'
        )
      })
      test('Previous day should move to the next week', () => {
        const now = '2023-06-01T12:00:00Z'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'WEEKLY',
            day: 'WEDNESDAY',
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-06-07 00:00:00.000 +00:00'
        )
      })
    })
    describe('MONTHLY mode', () => {
      test('Basic case', () => {
        const now = new Date('2023-02-02T12:00:00Z')
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'MONTHLY',
            day: 10,
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-02-10 00:00:00.000 +00:00'
        )
      })
      test('Day after today', () => {
        const now = '2023-06-15T12:00:00Z'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'MONTHLY',
            day: 16,
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-06-16 00:00:00.000 +00:00'
        )
      })
      test('The same day should move to the next month', () => {
        const now = '2023-06-15T12:00:00Z'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'MONTHLY',
            day: 15,
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-07-15 00:00:00.000 +00:00'
        )
      })
      test('Previous day should move to the next month', () => {
        const now = '2023-06-15T12:00:00Z'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'MONTHLY',
            day: 14,
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-07-14 00:00:00.000 +00:00'
        )
      })
      test('Stay within a month', () => {
        const now = new Date('2023-02-01T12:00:00Z')
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'MONTHLY',
            day: 31,
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-02-28 00:00:00.000 +00:00'
        )
      })
      test('Switch to next month and stay within a month', () => {
        const now = new Date('2023-01-31T12:00:00Z')
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'MONTHLY',
            day: 30,
          },
          DEFAULT_TIMEZONE
        )
        expect(dayjs(result).format(DATE_FORMAT)).toEqual(
          '2023-02-28 00:00:00.000 +00:00'
        )
      })
      test('Another timezone', () => {
        const now = '2023-06-15T12:00:00Z'
        const timezone = 'Europe/Berlin'
        const result = calculateCaseAvailableDate(
          dayjs(now).valueOf(),
          {
            type: 'MONTHLY',
            day: 14,
          },
          timezone
        )
        expect(dayjs(result).tz(timezone).format(DATE_FORMAT)).toEqual(
          '2023-07-14 00:00:00.000 +02:00'
        )
      })
    })
  })
})
