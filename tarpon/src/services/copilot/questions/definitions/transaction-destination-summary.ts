import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { PropertiesQuestion } from '@/services/copilot/questions/types'
import {
  humanReadablePeriod,
  Period,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/databricks'
export const TransactionDestinationSummary: PropertiesQuestion<Period> = {
  type: 'PROPERTIES',
  questionId: COPILOT_QUESTIONS.TRANSACTION_INSIGHTS_FOR_DESTINATION,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ username }, { ...period }) => {
    return `Transaction insights for ${username} ${humanReadablePeriod(
      period
    )} as destination`
  },
  aggregationPipeline: async ({ userId }, { ...period }) => {
    const [result] = await executeSql<{
      count: number
      min: number
      max: number
      total: number
      avg: number
    }>(
      `
    select
      count(*) as count,
      coalesce(min(t.destinationAmountDetails.transactionAmount), 0) as min,
      coalesce(max(t.destinationAmountDetails.transactionAmount), 0) as max,
      coalesce(sum(t.destinationAmountDetails.transactionAmount), 0) as total,
      coalesce(avg(t.destinationAmountDetails.transactionAmount), 0) as avg
    from
      transactions t
      where t.destinationUserId = :userId
        and t.timestamp between :from and :to
    `,
      { userId, ...sqlPeriod(period) }
    )
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
