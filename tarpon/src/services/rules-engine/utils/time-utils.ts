import { getFiscalYearStart } from '@flagright/lib/utils/time'
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

export function subtractTime(timestamp: Dayjs, timeWindow: TimeWindow): number {
  const granularity =
    timeWindow.granularity === 'fiscal_year' ? 'year' : timeWindow.granularity

  if (timeWindow.granularity === 'fiscal_year' && timeWindow.fiscalYear) {
    const fiscalYearStart = getFiscalYearStart(timestamp, timeWindow.fiscalYear)
    const afterTimestamp = fiscalYearStart.subtract(
      timeWindow.units - 1,
      'year'
    )

    return afterTimestamp.valueOf()
  }

  let afterTimestamp = timestamp
    .subtract(timeWindow.units, granularity)
    .valueOf()

  if (
    !timeWindow.rollingBasis &&
    ['day', 'week', 'month', 'year'].includes(timeWindow.granularity) &&
    timeWindow.units > 0
  ) {
    afterTimestamp = timestamp
      .startOf(granularity)
      .subtract(timeWindow.units - 1, granularity)
      .valueOf()

    if (afterTimestamp.valueOf() === timestamp.valueOf()) {
      afterTimestamp = timestamp
        .startOf(granularity)
        .subtract(timeWindow.units, granularity)
        .valueOf()
    }
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
