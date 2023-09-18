import dayjs from '@/utils/dayjs'
import { VariableOptions } from '@/services/copilot/questions/types'

export const periodDefaults = (days = 30): Period => {
  return {
    from: dayjs().subtract(days, 'days').valueOf(),
    to: dayjs().valueOf(),
  }
}

export type Period = { from: number; to: number }
export const periodVars: VariableOptions<Period> = {
  from: 'DATETIME',
  to: 'DATETIME',
}

export function humanReadablePeriod(period: Period): string {
  const startDate = dayjs(period.from)
  const endDate = dayjs(period.to)

  // Check if the time period is for a single day
  if (startDate.isSame(endDate, 'day')) {
    // Check if the time period is for a single hour
    if (startDate.isSame(endDate, 'hour')) {
      return `${startDate.format('D/M/YYYY HH:mm')}`
    } else {
      return `${startDate.format('D/M/YYYY HH:mm')} - ${endDate.format(
        'HH:mm'
      )}`
    }
  }
  const isToday = endDate.toDate().toDateString() === new Date().toDateString()
  if (isToday) {
    if (endDate.diff(startDate, 'days') == 6) {
      return `the last week`
    }
    if (endDate.diff(startDate, 'days') <= 30) {
      return `the last ${endDate.diff(startDate, 'days')} days`
    }
  }
  return `${startDate.format('D/M/YYYY')} - ${endDate.format('D/M/YYYY')}`
}
