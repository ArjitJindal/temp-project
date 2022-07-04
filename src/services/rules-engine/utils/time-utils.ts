import dayjs from 'dayjs'
import { TimeWindow } from '../transaction-rules/transactions-volume'

export function subtractTime(
  timeStamp: dayjs.Dayjs,
  timeWindow: TimeWindow
): number {
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
