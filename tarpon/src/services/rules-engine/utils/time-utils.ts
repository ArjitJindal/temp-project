import { getFiscalYearStart } from '@flagright/lib/utils/time'
import { TimeWindow } from '@/@types/rule/params'
import dayjs, { Dayjs } from '@/utils/dayjs'
import { LogicAggregationTimeWindow } from '@/@types/openapi-internal/LogicAggregationTimeWindow'

export type TimeWindowGranularity =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'fiscal_year'
export const TRANSACTION_EVENT_CYCLE_TIME = 4
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
  timeWindow: TimeWindow,
  useEventTimestamp = false
): { afterTimestamp: number; beforeTimestamp: number } {
  const afterTimestamp = subtractTime(dayjs(timestamp), timeWindow)
  return {
    afterTimestamp: useEventTimestamp
      ? dayjs(afterTimestamp)
          .subtract(TRANSACTION_EVENT_CYCLE_TIME, 'week')
          .valueOf() // Adding 4 weeks to include the transactions for whcih
      : afterTimestamp,
    beforeTimestamp: timestamp,
  }
}

export function getTimeRangeByTimeWindows(
  currentTimestamp: number,
  timeWindowFrom: LogicAggregationTimeWindow,
  timeWindowTo: LogicAggregationTimeWindow,
  useEventTimestamp = false
) {
  let afterTimestamp: number, beforeTimestamp: number
  if (timeWindowFrom.granularity === 'all_time') {
    afterTimestamp = dayjs(currentTimestamp).subtract(5, 'year').valueOf()
  } else {
    afterTimestamp = getTimestampRange(
      currentTimestamp,
      timeWindowFrom as TimeWindow,
      useEventTimestamp
    ).afterTimestamp
  }
  if (timeWindowTo.granularity === 'now') {
    beforeTimestamp = currentTimestamp
  } else {
    beforeTimestamp = getTimestampRange(
      currentTimestamp,
      timeWindowTo as TimeWindow
    ).afterTimestamp
  }
  return { afterTimestamp, beforeTimestamp }
}

export function getTimeDiff(
  t1: Dayjs,
  t2: Dayjs,
  unit: 'day' | 'week' | 'month' | 'year'
) {
  return t1.startOf('day').diff(t2.startOf('day'), unit, true)
}
