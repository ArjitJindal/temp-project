import { ManipulateType } from 'dayjs'
import dayjs from '@/utils/dayjs'

export function getTimeLabels(
  formatType: string,
  startTimestamp: number,
  endTimestamp: number,
  granularity: 'HOUR' | 'DAY' | 'MONTH'
) {
  const timeLabels: string[] = []
  for (
    let time = dayjs(getAffectedInterval(startTimestamp, granularity).start);
    time < dayjs(getAffectedInterval(endTimestamp, granularity).end);
    time = dayjs(time).add(1, granularity.toLowerCase() as ManipulateType)
  ) {
    timeLabels.push(time.format(formatType))
  }

  return timeLabels
}

export function getAffectedInterval(
  timestamp: number,
  granularity: 'HOUR' | 'DAY' | 'MONTH'
) {
  const time = dayjs(timestamp)
  if (granularity === 'HOUR') {
    const newTime = time.minute(0).second(0).millisecond(0)
    return { start: newTime.valueOf(), end: newTime.add(1, 'hour').valueOf() }
  } else if (granularity === 'DAY') {
    const newTime = time.hour(0).minute(0).second(0).millisecond(0)
    return { start: newTime.valueOf(), end: newTime.add(1, 'day').valueOf() }
  } else if (granularity === 'MONTH') {
    const newTime = time.date(1).hour(0).minute(0).second(0).millisecond(0)
    return { start: newTime.valueOf(), end: newTime.add(1, 'month').valueOf() }
  }
  throw new Error('Unhandled granularity')
}
