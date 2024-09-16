import { BETWEEN_TIME_OPERATOR } from '../between-time'
import dayjs from '@/utils/dayjs'

function getSecondsFromTimestamp(timestamp: number): number {
  return dayjs(timestamp).diff(dayjs(timestamp).startOf('day'), 'seconds')
}

describe('Between Time', () => {
  test('should return true if the value is between the range - correct order', async () => {
    const timeInSecondsStart = getSecondsFromTimestamp(
      dayjs('2021-01-01 12:00:00').valueOf()
    ) as number

    const timeInSecondsEnd = getSecondsFromTimestamp(
      dayjs('2021-01-01 13:00:00').valueOf()
    ) as number

    const value = getSecondsFromTimestamp(
      dayjs('2021-01-01 12:30:00').valueOf()
    ) as number

    const result = await BETWEEN_TIME_OPERATOR.run(value, [
      timeInSecondsStart,
      timeInSecondsEnd,
    ])

    expect(result).toBe(true)
  })

  test('should return false if the value is not between the range', async () => {
    const timeInSecondsStart = getSecondsFromTimestamp(
      dayjs('2021-01-01 12:00:00').valueOf()
    ) as number

    const timeInSecondsEnd = getSecondsFromTimestamp(
      dayjs('2021-01-01 13:00:00').valueOf()
    ) as number

    const value = getSecondsFromTimestamp(
      dayjs('2021-01-01 14:30:00').valueOf()
    ) as number

    const result = await BETWEEN_TIME_OPERATOR.run(value, [
      timeInSecondsStart,
      timeInSecondsEnd,
    ])

    expect(result).toBe(false)
  })

  test('should return true if the value is between the range - incorrect order', async () => {
    const timeInSecondsStart = getSecondsFromTimestamp(
      dayjs('2021-01-01 23:00:00').valueOf()
    ) as number

    const timeInSecondsEnd = getSecondsFromTimestamp(
      dayjs('2021-01-01 02:00:00').valueOf()
    ) as number

    const value = getSecondsFromTimestamp(
      dayjs('2021-01-01 00:30:00').valueOf()
    ) as number

    const result = await BETWEEN_TIME_OPERATOR.run(value, [
      timeInSecondsStart,
      timeInSecondsEnd,
    ])

    expect(result).toBe(true)
  })

  test('should return false if the value is not between the range - incorrect order', async () => {
    const timeInSecondsStart = getSecondsFromTimestamp(
      dayjs('2021-01-01 23:00:00').valueOf()
    ) as number

    const timeInSecondsEnd = getSecondsFromTimestamp(
      dayjs('2021-01-01 02:00:00').valueOf()
    ) as number

    const value = getSecondsFromTimestamp(
      dayjs('2021-01-01 03:30:00').valueOf()
    ) as number

    const result = await BETWEEN_TIME_OPERATOR.run(value, [
      timeInSecondsStart,
      timeInSecondsEnd,
    ])

    expect(result).toBe(false)
  })

  test('should return true if the value is the same as the start time', async () => {
    const timeInSecondsStart = getSecondsFromTimestamp(
      dayjs('2021-01-01 12:00:00').valueOf()
    ) as number

    const timeInSecondsEnd = getSecondsFromTimestamp(
      dayjs('2021-01-01 13:00:00').valueOf()
    ) as number

    const value = getSecondsFromTimestamp(
      dayjs('2021-01-01 12:00:00').valueOf()
    ) as number

    const result = await BETWEEN_TIME_OPERATOR.run(value, [
      timeInSecondsStart,
      timeInSecondsEnd,
    ])

    expect(result).toBe(true)
  })
})
