import dayjs from '@/utils/dayjs'
import { VariableOptions } from '@/services/copilot/questions/types'

export const periodDefaults = (days = 30): Period => {
  return {
    from: dayjs().subtract(days, 'days').valueOf(),
    to: dayjs().valueOf(),
  }
}

export type Period = { from?: number; to?: number }
export const periodVars: VariableOptions<Period> = {
  from: 'DATETIME',
  to: 'DATETIME',
}

export function humanReadablePeriod(period: Period): string {
  if (!period.to && !period.from) {
    return 'for all time'
  }

  const startDate = dayjs(period.from)
  const endDate = dayjs(period.to)

  // Check if the time period is for a single day
  if (startDate.isSame(endDate, 'day')) {
    // Check if the time period is for a single hour
    if (startDate.isSame(endDate, 'hour')) {
      return `for ${startDate.format(DATETIME_GRAPH_FORMAT)}`
    } else {
      return `between ${startDate.format(
        DATETIME_GRAPH_FORMAT
      )} - ${endDate.format(TIME_GRAPH_FORMAT)}`
    }
  }
  const isToday = endDate.toDate().toDateString() === new Date().toDateString()
  if (isToday) {
    if (endDate.diff(startDate, 'days') == 6) {
      return `over the last week`
    }
    if (endDate.diff(startDate, 'days') <= 30) {
      return `over the last ${endDate.diff(startDate, 'days')} days`
    }
  }
  return `between ${startDate.format(DATE_GRAPH_FORMAT)} - ${endDate.format(
    DATE_GRAPH_FORMAT
  )}`
}

export function dates(period: Period): string[] {
  let cursor = dayjs(period.from)
  const end = dayjs(period.to)
  const output: string[] = []
  while (cursor <= end) {
    output.push(cursor.format(DATE_FORMAT))
    cursor = cursor.add(1, 'd')
  }
  return output
}

export function matchPeriod(timestampField: string, period: Period) {
  if (!period.from && !period.to) {
    return {}
  }
  const filters = {}
  if (period.from) {
    filters['$gte'] = period.from
  }
  if (period.to) {
    filters['$lte'] = period.to
  }
  return { [timestampField]: filters }
}

export const MONGO_DATE_FORMAT = '%Y-%m-%d'
export const DATE_FORMAT = 'YYYY-MM-DD'
export const DATE_GRAPH_FORMAT = 'D/M/YYYY'
export const DATETIME_GRAPH_FORMAT = 'D/M/YYYY HH:mm'
export const TIME_GRAPH_FORMAT = 'HH:mm'
