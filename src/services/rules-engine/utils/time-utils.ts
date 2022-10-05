import { TimeWindow } from './rule-parameter-schemas'
import { Dayjs, duration } from '@/utils/dayjs'

export type TimeWindowGranularity =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'

export function toGranularity(
  timeWindow: TimeWindow,
  granularity: TimeWindowGranularity
): TimeWindow {
  if (timeWindow.granularity === granularity) {
    return timeWindow
  }
  return {
    granularity: granularity,
    units: duration(timeWindow.units, timeWindow.granularity).as(granularity),
  }
}

export function subtractTime(timeStamp: Dayjs, timeWindow: TimeWindow): number {
  let afterTimestamp = timeStamp
    .subtract(timeWindow.units, timeWindow.granularity)
    .valueOf()
  if (
    !timeWindow.rollingBasis &&
    (timeWindow.granularity === 'day' ||
      timeWindow.granularity === 'week' ||
      timeWindow.granularity === 'month')
  ) {
    afterTimestamp = timeStamp
      .startOf(timeWindow.granularity)
      .subtract(timeWindow.units - 1, timeWindow.granularity)
      .valueOf()
  }
  return afterTimestamp
}
