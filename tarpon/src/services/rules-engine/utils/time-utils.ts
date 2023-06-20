import { TimeWindow } from './rule-parameter-schemas'
import dayjs, { Dayjs } from '@/utils/dayjs'

export type TimeWindowGranularity =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'fiscal_year'

export type TimeWindowFiscalYear = {
  startMonth: number
  startDay: number
}

function getFiscalYearStart(
  transactionDate: Dayjs,
  fiscalYear: TimeWindowFiscalYear
): Dayjs {
  const { startMonth, startDay } = fiscalYear
  const fiscalYearStart =
    transactionDate.month() < startMonth - 1
      ? transactionDate
          .subtract(1, 'year')
          .startOf('year')
          .add(startMonth - 1, 'month')
          .add(startDay - 1, 'day')
      : transactionDate
          .startOf('year')
          .add(startMonth - 1, 'month')
          .add(startDay - 1, 'day')

  return fiscalYearStart
}

export function subtractTime(timeStamp: Dayjs, timeWindow: TimeWindow): number {
  const granularity =
    timeWindow.granularity === 'fiscal_year' ? 'year' : timeWindow.granularity

  if (timeWindow.granularity === 'fiscal_year' && timeWindow.fiscalYear) {
    const fiscalYearStart = getFiscalYearStart(timeStamp, timeWindow.fiscalYear)
    const afterTimestamp = fiscalYearStart.subtract(
      timeWindow.units - 1,
      'year'
    )

    return afterTimestamp.valueOf()
  }

  let afterTimestamp = timeStamp
    .subtract(timeWindow.units, granularity)
    .valueOf()

  if (
    !timeWindow.rollingBasis &&
    ['day', 'week', 'month', 'year'].includes(timeWindow.granularity)
  ) {
    afterTimestamp = timeStamp
      .startOf(granularity)
      .subtract(timeWindow.units - 1, granularity)
      .valueOf()
  }

  return afterTimestamp
}

export function getTimestampRange(
  timestamp: number,
  timeWindow: TimeWindow
): { afterTimestamp: number; beforeTimestamp: number } {
  return {
    afterTimestamp: subtractTime(dayjs(timestamp), timeWindow),
    beforeTimestamp: timestamp,
  }
}
