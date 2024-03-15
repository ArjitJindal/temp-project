import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { PropertiesQuestion } from '@/services/copilot/questions/types'
import {
  currencyDefault,
  currencyVars,
  Direction,
  directionDefault,
  directionVars,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/databricks'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
export const TransactionSummary: PropertiesQuestion<
  Period & { currency: CurrencyCode; direction: Direction }
> = {
  type: 'PROPERTIES',
  questionId: COPILOT_QUESTIONS.TRANSACTION_INSIGHTS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ username }, { direction, ...period }) => {
    return `Transaction insights for ${username} as ${direction.toLowerCase()} ${humanReadablePeriod(
      period
    )} as originator`
  },
  aggregationPipeline: async (
    { convert, userId },
    { direction, currency, ...period }
  ) => {
    const userIdKey =
      direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
    const raw = await executeSql<{
      count: number
      min: number
      max: number
      total: number
      avg: number
    }>(
      `
    select
      count(*) as count,
      coalesce(min(t.transactionAmountUSD), 0) as min,
      coalesce(max(t.transactionAmountUSD), 0) as max,
      coalesce(sum(t.transactionAmountUSD), 0) as total,
      coalesce(avg(t.transactionAmountUSD), 0) as avg
    from
      transactions t
      where t.${userIdKey} = :userId
        and t.timestamp between :from and :to
    `,
      { userId, ...sqlPeriod(period) }
    )
    const result = raw[0]
    return {
      data: [
        {
          key: 'Transaction count',
          value: result.count.toFixed(0),
        },
        {
          key: 'Max amount',
          value: convert(result.max, currency).toFixed(2),
        },
        {
          key: 'Min amount',
          value: convert(result.min, currency).toFixed(2),
        },
        {
          key: 'Average amount',
          value: convert(result.avg, currency).toFixed(2),
        },
        {
          key: 'Total amount',
          value: convert(result.total, currency).toFixed(2),
        },
      ],
      summary: ``,
    }
  },
  variableOptions: {
    ...periodVars,
    ...currencyVars,
    ...directionVars,
  },
  defaults: () => {
    return {
      ...periodDefaults(),
      ...currencyDefault,
      ...directionDefault,
    }
  },
}
