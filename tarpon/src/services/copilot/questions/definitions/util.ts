import { BadRequest } from 'http-errors'
import dayjs from '@/utils/dayjs'
import { VariableOptions } from '@/services/copilot/questions/types'
import { getContext } from '@/core/utils/context-storage'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { getUserName } from '@/utils/helpers'
import { CURRENCY_CODES } from '@/@types/openapi-public-custom/CurrencyCode'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export const MONGO_DATE_FORMAT = '%Y-%m-%d'
export const DATE_GRAPH_FORMAT = 'D/M/YYYY'
export const DATETIME_GRAPH_FORMAT = 'D/M/YYYY HH:mm'
export const TIME_GRAPH_FORMAT = 'HH:mm'

export const periodDefaults = (days = 90): Period => {
  return {
    from: dayjs().subtract(days, 'days').valueOf(),
    to: dayjs().valueOf(),
  }
}

export const currencyDefault: { currency: CurrencyCode } = {
  currency: 'USD',
}

export type Period = {
  from?: number
  to?: number
  sortField?: string
  sortOrder?: string
}
export const periodVars: VariableOptions<Period> = {
  from: 'DATE',
  to: 'DATE',
}

export const currencyVars: VariableOptions<{ currency: string }> = {
  currency: {
    type: 'AUTOCOMPLETE',
    options: () => CURRENCY_CODES,
  },
}

export type Direction = 'ORIGIN' | 'DESTINATION'

export const directionDefault: { direction: Direction } = {
  direction: 'ORIGIN',
}

export const directionVars: VariableOptions<{ direction: Direction }> = {
  direction: {
    type: 'AUTOCOMPLETE',
    options: () => ['ORIGIN', 'DESTINATION'],
  },
}

export function humanReadablePeriod(period: Period): string {
  if (!period.to && !period.from) {
    return '(all time)'
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

export const GRANULARITIES = [
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Yearly',
]
export type TimeGranularity = (typeof GRANULARITIES)[number]

export function timeXAxis(granularity: TimeGranularity = 'Daily'): string {
  switch (granularity) {
    case 'Daily':
      return 'DAY'
    case 'Weekly':
      return 'WEEK'
    case 'Monthly':
      return 'MONTH'
    case 'Quarterly':
      return 'QUARTER'
    case 'Yearly':
      return 'YEAR'
  }
  throw new BadRequest(`Unknown time granularity: ${granularity}`)
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

export function matchPeriodSQL(timestampField: string, period: Period) {
  if (!period.from && !period.to) {
    return ''
  }
  const filters: string[] = []

  if (period.from) {
    filters.push(`${timestampField} >= ${period.from}`)
  }
  if (period.to) {
    filters.push(`${timestampField} <= ${period.to}`)
  }
  return filters.join(' AND ')
}

export function sqlPeriod(period: Period) {
  return {
    from: period.from || 0,
    to: period.to || new Date().valueOf(),
  }
}

export function dates(period: Period): string[] {
  let cursor = dayjs(period.from)
  const end = dayjs(period.to)
  const output: string[] = []
  while (cursor <= end) {
    output.push(cursor.format('YYYY-MM-DD'))
    cursor = cursor.add(1, 'd')
  }

  return output
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

export async function queryUsername(userId: string) {
  const tenantId = getContext()?.tenantId
  if (!tenantId) {
    throw new BadRequest('No tenant ID')
  }
  const client = await getMongoDbClient()
  const db = client.db()
  const result = await db
    .collection<InternalConsumerUser | InternalBusinessUser>(
      USERS_COLLECTION(tenantId)
    )
    .findOne({ userId })

  return getUserName(result)
}

export function casePaymentIdentifierQuery(paymentIdentifier?: PaymentDetails) {
  if (!paymentIdentifier) {
    return []
  }
  const keys = PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentIdentifier.method]
  const originConditions = keys.map((key) => {
    return {
      [`paymentDetails.origin.${key}`]: paymentIdentifier[key],
    }
  })
  const destinationConditions = keys.map((key) => {
    return {
      [`paymentDetails.destination.${key}`]: paymentIdentifier[key],
    }
  })
  return [
    {
      $and: originConditions,
    },
    {
      $and: destinationConditions,
    },
  ]
}

export function paymentIdentifierQueryClickhouse(
  paymentIdentifier?: PaymentDetails,
  direction?: 'ORIGIN' | 'DESTINATION'
) {
  if (!paymentIdentifier) {
    return ''
  }
  const keys = PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentIdentifier.method]
  const originConditions = keys
    .filter((key) => paymentIdentifier[key])
    .map((key) => {
      return `originPaymentDetails_${key} = '${paymentIdentifier[key]}'`
    })
    .join(' AND ')

  const destinationConditions = keys
    .filter((key) => paymentIdentifier[key])
    .map((key) => {
      return `destinationPaymentDetails_${key} = '${paymentIdentifier[key]}'`
    })
    .join(' AND ')

  if (direction === 'ORIGIN') {
    return originConditions
  }
  if (direction === 'DESTINATION') {
    return destinationConditions
  }

  return `(${originConditions}) OR (${destinationConditions})`
}
