import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import { TimeseriesQuestion } from '@/services/copilot/questions/types'
import {
  currencyDefault,
  currencyVars,
  GRANULARITIES,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
  TimeGranularity,
  timeXAxis,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/databricks'
import dayjs from '@/utils/dayjs'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export const transactionAggregationQuestion = (
  questionId: QuestionId,
  title: string,
  aggregationExpression: (granularity: TimeGranularity) => string,
  showCurrency = false,
  joins = ''
): TimeseriesQuestion<
  Period & { granularity: TimeGranularity; currency: CurrencyCode }
> => ({
  type: 'TIME_SERIES',
  questionId,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `${title} ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (ctx, { granularity, currency, ...period }) => {
    const sqlExpression = timeXAxis(granularity)
    const rows = await executeSql<{
      timestamp: Date
      date: string
      agg: number
    }>(
      `
        WITH DateSeries AS (
  SELECT
    date_trunc('${sqlExpression}', date) AS period_start
  FROM
    (
      SELECT
        EXPLODE(
          SEQUENCE(
            TO_DATE(:from),
            TO_DATE(:to),
            INTERVAL ${
              sqlExpression === 'QUARTER' ? '3 MONTH' : `1 ${sqlExpression}`
            }
          )
        ) AS date
    )
  GROUP BY
    date_trunc('${sqlExpression}', date)
)
SELECT
  any_value(ds.period_start) as timestamp,
  date_format(ds.period_start, 'yyyy-MM-dd') as date,
  ${aggregationExpression(granularity)} as agg
FROM
  DateSeries ds
  LEFT JOIN transactions t ON date_trunc('${sqlExpression}', CAST(DATE(FROM_UNIXTIME(CAST(t.timestamp / 1000 AS BIGINT))) AS DATE)) = ds.period_start
  ${joins}
  AND (
    t.originUserId = :userId
    OR t.destinationUserId = :userId
  )
GROUP BY
  date
ORDER BY
  date ASC
    `,
      {
        userId: ctx.userId,
        from: dayjs(period.from).format('YYYY-MM-DD'),
        to: dayjs(period.to).format('YYYY-MM-DD'),
      }
    )

    return {
      data: [
        {
          label: '',
          values: rows.map((row) => {
            return {
              time: row.timestamp.getTime(),
              value: ctx.convert(row.agg, currency),
            }
          }),
        },
      ],
      summary: ``,
    }
  },
  variableOptions: {
    ...periodVars,
    ...(showCurrency ? currencyVars : {}),
    granularity: {
      // TODO implement an "options" variable type
      type: 'AUTOCOMPLETE',
      options: () => GRANULARITIES,
    },
  },
  defaults: () => {
    return {
      ...periodDefaults(),
      ...currencyDefault,
      granularity: 'Daily',
    }
  },
})

export const TrsScore = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRS_SCORE,
  'TRS score distribution',
  () => 'avg(ar.arsScore)',
  false,
  'left join action_risk_values ar on ar.transactionId = t.transactionId'
)

export const TransactionCount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRANSACTION_COUNT,
  'Transaction count',
  () => 'count(t.transactionId)'
)

export const MaxTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MAX_TRANSACTION_AMOUNT,
  'Max transaction amount',
  () => 'max(transactionAmountUSD)',
  true
)

export const MinTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MIN_TRANSACTION_AMOUNT,
  'Min transaction amount',
  () => 'min(transactionAmountUSD)',
  true
)
export const AverageTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.AVERAGE_TRANSACTION_AMOUNT,
  'Average transaction amount',
  () => 'avg(transactionAmountUSD)',
  true
)

export const MedianTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MEDIAN_TRANSACTION_AMOUNT,
  'Median transaction amount',
  () => 'percentile_approx(transactionAmountUSD, 0.5)',
  true
)

export const TotalTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TOTAL_TRANSACTION_AMOUNT,
  'Total transaction amount',
  () => 'sum(transactionAmountUSD)',
  true
)

export const TransactionLimit = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRANSACTION_LIMIT,
  'Remaining transaction limit',
  (granularity) =>
    `(select transactionLimits.maximum${granularity}TransactionLimit.amountValue from users where userId = :userId LIMIT 1) - COALESCE(SUM(transactionAmountUSD), 0)`,
  true
)

export const TransactionAggregations = [
  TrsScore,
  TransactionCount,
  AverageTransactionAmount,
  MaxTransactionAmount,
  MinTransactionAmount,
  MedianTransactionAmount,
  TransactionLimit,
  TotalTransactionAmount,
]
