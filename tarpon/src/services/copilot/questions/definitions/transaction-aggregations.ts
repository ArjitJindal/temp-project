import { COPILOT_QUESTIONS, CopilotQuestionIds } from '@flagright/lib/utils'
import { TimeseriesQuestion } from '@/services/copilot/questions/types'
import {
  dates,
  humanReadablePeriod,
  months,
  Period,
  periodDefaults,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/databricks'
import dayjs from '@/utils/dayjs'

export const transactionAggregationQuestion = (
  questionId: CopilotQuestionIds,
  title: string,
  agg: string,
  join: string = ''
): TimeseriesQuestion<Period> => ({
  type: 'TIME_SERIES',
  questionId,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `${title} ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ userId }, period) => {
    let timeFormat = 'yyyy-MM'
    let xAxis = months(period)
    if (dayjs(period.to).diff(dayjs(period.from), 'd') < 90) {
      timeFormat = 'yyyy-MM-dd'
      xAxis = dates(period)
    }
    const result = await executeSql<{ date: string; agg: number }>(
      `
      select
        date_format(DATE(
          FROM_UNIXTIME(CAST(t.timestamp / 1000 AS BIGINT))
        ), '${timeFormat}') as date,
        ${agg} as agg
      from
        transactions t
        ${join}
      where
        (t.originUserId = :userId or t.destinationUserId = :userId)
        and t.timestamp between :from and :to
      group by
        date
      order by
        date asc
    `,
      {
        userId,
        ...sqlPeriod(period),
      }
    )

    const avgMap = new Map(result.map((item) => [item.date, item.agg]))
    return {
      data: [
        {
          label: '',
          values: xAxis.map((d) => {
            return {
              time: new Date(d).valueOf(),
              value: avgMap.get(d) || 0,
            }
          }),
        },
      ],
      summary: ``,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
})

export const TrsScore = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRS_SCORE,
  'TRS score distribution',
  'avg(ar.arsScore)',
  'join action_risk_values ar on ar.transactionId = t.transactionId'
)

export const TransactionCount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRANSACTION_COUNT,
  'Transaction count',
  'count(*)'
)

export const MaxTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MAX_TRANSACTION_AMOUNT,
  'Max transaction amount',
  'max(originAmountDetails.transactionAmount)'
)

export const MinTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MIN_TRANSACTION_AMOUNT,
  'Min transaction amount',
  'min(originAmountDetails.transactionAmount)'
)
export const AverageTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.AVERAGE_TRANSACTION_AMOUNT,
  'Average transaction amount',
  'avg(originAmountDetails.transactionAmount)'
)

export const MedianTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MEDIAN_TRANSACTION_AMOUNT,
  'Median transaction amount',
  'percentile_approx(originAmountDetails.transactionAmount, 0.5)'
)

export const TransactionAggregations = [
  TrsScore,
  TransactionCount,
  AverageTransactionAmount,
  MaxTransactionAmount,
  MinTransactionAmount,
  MedianTransactionAmount,
]
