import { PropertiesQuestion } from '@/services/copilot/questions/types'
import {
  humanReadablePeriod,
  Period,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/databricks'
export const TransactionOriginSummary: PropertiesQuestion<Period> = {
  type: 'PROPERTIES',
  questionId: 'Transaction insights for originator',
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ username }, { ...period }) => {
    return `Transaction insights for ${username} ${humanReadablePeriod(
      period
    )} as originator`
  },
  aggregationPipeline: async ({ userId }, { ...period }) => {
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
      coalesce(min(t.originAmountDetails.transactionAmount), 0) as min,
      coalesce(min(t.originAmountDetails.transactionAmount), 0) as max,
      coalesce(sum(t.originAmountDetails.transactionAmount), 0) as total,
      coalesce(min(t.originAmountDetails.transactionAmount), 0) as max,
      coalesce(avg(t.originAmountDetails.transactionAmount), 0) as avg
    from
      transactions t
      where t.originUserId = :userId
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
          value: result.max.toFixed(2),
        },
        {
          key: 'Min amount',
          value: result.min.toFixed(2),
        },
        {
          key: 'Average amount',
          value: result.avg.toFixed(2),
        },
        {
          key: 'Total amount',
          value: result.total.toFixed(2),
        },
      ],
      summary: ``,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
