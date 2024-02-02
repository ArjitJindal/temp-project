import { ManipulateType } from '@flagright/lib/utils/dayjs'
import { isEmpty } from 'lodash'
import dayjs from '@/utils/dayjs'
import { neverThrow } from '@/utils/lang'

export function getTimeLabels(
  formatType: string,
  startTimestamp: number,
  endTimestamp: number,
  granularity: 'HOUR' | 'DAY' | 'MONTH'
) {
  const timeLabels: string[] = []
  const { start, end } = getAffectedInterval(
    { startTimestamp, endTimestamp },
    granularity
  )
  for (
    let time = dayjs(start);
    time < dayjs(end);
    time = dayjs(time).add(1, granularity.toLowerCase() as ManipulateType)
  ) {
    timeLabels.push(time.format(formatType))
  }

  return timeLabels
}

export function getAffectedInterval(
  timeRange: {
    startTimestamp?: number
    endTimestamp?: number
  },
  granularity: 'HOUR' | 'DAY' | 'MONTH'
) {
  if (isEmpty(timeRange)) {
    return { start: 0, end: Date.now() }
  }

  const { startTimestamp, endTimestamp } = timeRange
  const startTime = dayjs(startTimestamp)
  const endTime = endTimestamp ? dayjs(endTimestamp) : null
  if (granularity === 'HOUR') {
    const newStart = startTime.minute(0).second(0).millisecond(0)
    const newEnd = endTime
      ? endTime.minute(0).second(0).millisecond(0).add(1, 'hour')
      : newStart.add(1, 'hour')
    return { start: newStart.valueOf(), end: newEnd.valueOf() }
  } else if (granularity === 'DAY') {
    const newStart = startTime.hour(0).minute(0).second(0).millisecond(0)
    const newEnd = endTime
      ? endTime.hour(0).minute(0).second(0).millisecond(0).add(1, 'day')
      : newStart.add(1, 'day')
    return { start: newStart.valueOf(), end: newEnd.valueOf() }
  } else if (granularity === 'MONTH') {
    const newStart = startTime
      .date(1)
      .hour(0)
      .minute(0)
      .second(0)
      .millisecond(0)
    const newEnd = endTime
      ? endTime
          .date(1)
          .hour(0)
          .minute(0)
          .second(0)
          .millisecond(0)
          .add(1, 'month')
      : newStart.add(1, 'month')
    return { start: newStart.valueOf(), end: newEnd.valueOf() }
  }
  throw neverThrow(granularity, 'Unhandled granularity')
}
