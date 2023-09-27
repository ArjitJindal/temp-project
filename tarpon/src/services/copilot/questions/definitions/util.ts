import dayjs from '@/utils/dayjs'
import { VariableOptions } from '@/services/copilot/questions/types'

export const MONGO_DATE_FORMAT = '%Y-%m-%d'
export const DATE_FORMAT = 'YYYY-MM-DD'
export const DATE_GRAPH_FORMAT = 'D/M/YYYY'
export const DATETIME_GRAPH_FORMAT = 'D/M/YYYY HH:mm'
export const TIME_GRAPH_FORMAT = 'HH:mm'

export const periodDefaults = (days = 30): Period => {
  return {
    from: dayjs().subtract(days, 'days').valueOf(),
    to: dayjs().valueOf(),
  }
}

export type Period = { from?: number; to?: number }
export const periodVars: VariableOptions<Period> = {
  from: 'DATE',
  to: 'DATE',
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
      // If we are just one second shy of going over the next day, then we want to add an extra day.
      // Useful for periods like "2022-01-01 00:00:00 - 2022-01-02 23:59:99"
      // which makes more sense to say as 3 days, although it's technically 2 calendar days.
      return `over the last ${endDate.add(1, 's').diff(startDate, 'days')} days`
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

export function calculatePercentageBreakdown(data: string[]): string {
  const threshold = 10
  const statusCount: { [status: string]: number } = {}

  // Count the occurrences of each alert status
  data.forEach((item) => {
    if (statusCount[item]) {
      statusCount[item]++
    } else {
      statusCount[item] = 1
    }
  })

  const totalCount = data.length

  // Calculate the percentage breakdown
  const percentageBreakdown: { [status: string]: number } = {}
  let otherStatusCount = 0

  for (const status in statusCount) {
    if (status in statusCount) {
      const percentage = (statusCount[status] / totalCount) * 100
      if (percentage >= threshold) {
        percentageBreakdown[status] = percentage
      } else {
        otherStatusCount += statusCount[status]
      }
    }
  }

  if (otherStatusCount > 0) {
    percentageBreakdown['Other'] = (otherStatusCount / totalCount) * 100
  }

  // Create the example text
  let exampleText = ''

  // Sort the percentage breakdowns in descending order
  const sortedPercentageBreakdown = Object.entries(percentageBreakdown)
    .sort(([, a], [, b]) => b - a)
    .reduce((obj, [key, value]) => {
      obj[key] = value
      return obj
    }, {})

  for (const status in sortedPercentageBreakdown) {
    if (status in percentageBreakdown) {
      exampleText += `${percentageBreakdown[status].toFixed(
        0
      )}% had "${status}" status, `
    }
  }

  exampleText = exampleText.slice(0, -1) // Remove the trailing comma
  const remainingPercentage =
    100 - Object.values(percentageBreakdown).reduce((sum, val) => sum + val, 0)
  if (Math.floor(remainingPercentage) > 0) {
    exampleText += `and the remaining ${remainingPercentage.toFixed(
      0
    )}% had other statuses`
  }

  return exampleText.trimEnd().replace(/,$/, '')
}
