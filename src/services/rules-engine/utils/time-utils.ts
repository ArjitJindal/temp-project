import { Dayjs } from '@/utils/dayjs'
import { TimeWindow } from '@/services/rules-engine/rule'

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
