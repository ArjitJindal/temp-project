import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import { TimeseriesQuestion } from '@/services/copilot/questions/types'
import {
  currencyDefault,
  currencyVars,
  GRANULARITIES,
  humanReadablePeriod,
  transactionPaymentIdentifierQuerySQL,
  Period,
  periodDefaults,
  periodVars,
  TimeGranularity,
  timeXAxis,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/viper'
import dayjs from '@/utils/dayjs'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { notEmpty } from '@/utils/array'

export const transactionAggregationQuestion = (
  questionId: QuestionId,
  title: string,
  aggregationExpression: (granularity: TimeGranularity) => string,
  showCurrency = false,
  joins = ''
): TimeseriesQuestion<
  Period & {
    granularity: TimeGranularity
    currency?: CurrencyCode
    showUserLimit: boolean
  }
> => ({
  type: 'TIME_SERIES',
  questionId: questionId,
  version: 2,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async (_, vars) => {
    return `${title} ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (
    ctx,
    { granularity, currency, showUserLimit, ...period }
  ) => {
    const sqlExpression = timeXAxis(granularity)
    const condition = ctx.userId
      ? `t.originUserId = :userId OR t.destinationUserId = :userId`
      : transactionPaymentIdentifierQuerySQL(ctx.paymentIdentifier)

    const rows = await executeSql<{
      timestamp: Date
      date: string
      agg: number
    }>(
      `, DateSeries AS (
  SELECT
    date_trunc('${sqlExpression}', date) AS period_start
  FROM
    (
      SELECT 
       date_add('day', row_number() OVER () - 1, DATE :from) AS date
      FROM 
       unnest(sequence(1, (date_diff('day', DATE :from, DATE :to) + 1))) AS t(day_number)
    )
  GROUP BY
    date_trunc('${sqlExpression}', date)
)
SELECT
  date_format(any_value(ds.period_start), 'yyyy-MM-dd') as date,
  any_value(ds.period_start) as timestamp,
  round(${aggregationExpression(granularity)}, 2) as agg
FROM
  DateSeries ds
  LEFT JOIN transactions t ON date_trunc('${sqlExpression}', t.date) = ds.period_start
  ${joins}
  AND (
    ${condition}
  )
GROUP BY
  ds.period_start
ORDER BY
  ds.period_start ASC
    `,
      {
        userId: ctx.userId,
        from: dayjs(period.from).format('YYYY-MM-DD'),
        to: dayjs(period.to).format('YYYY-MM-DD'),
        ...ctx.paymentIdentifier,
      }
    )

    const values = rows.map((row) => {
      return {
        time: row.timestamp.getTime(),
        value: currency ? ctx.convert(row.agg, currency) : row.agg,
      }
    })

    let userLimitValues: { value: number; time: number }[] = []
    if (showUserLimit) {
      let limit
      switch (granularity) {
        case 'Daily':
          limit = ctx.user?.transactionLimits?.maximumDailyTransactionLimit
          break
        case 'Weekly':
          limit = ctx.user?.transactionLimits?.maximumWeeklyTransactionLimit
          break
        case 'Monthly':
          limit = ctx.user?.transactionLimits?.maximumMonthlyTransactionLimit
          break
        case 'Quarterly':
          limit = ctx.user?.transactionLimits?.maximumQuarterlyTransactionLimit
          break
        case 'Yearly':
          limit = ctx.user?.transactionLimits?.maximumYearlyTransactionLimit
          break
      }
      if (limit && values.length > 0) {
        const currencyLimit = currency
          ? ctx.convert(limit.amountValue, currency)
          : limit.amountValue
        userLimitValues = values.map((x) => ({ ...x, value: currencyLimit }))
      }
    }

    return {
      data: [
        {
          label: '',
          values: values,
        },
        userLimitValues && {
          label: 'User’s transactions limits',
          values: userLimitValues,
        },
      ].filter(notEmpty),
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
    showUserLimit: 'BOOLEAN',
  },
  defaults: () => {
    return {
      ...periodDefaults(),
      ...currencyDefault,
      granularity: 'Daily',
      showUserLimit: false,
    }
  },
})

const TrsScore = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRS_SCORE,
  'TRS score distribution',
  () => 'avg(ar.arsScore)',
  false,
  'left join action_risk_values ar on ar.transactionId = t.transactionId'
)

const TransactionCount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRANSACTION_COUNT,
  'Transaction count',
  () => 'count(t.transactionId)'
)

const MaxTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MAX_TRANSACTION_AMOUNT,
  'Max transaction amount',
  () => 'max(transactionAmountUSD)',
  true
)

const MinTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MIN_TRANSACTION_AMOUNT,
  'Min transaction amount',
  () => 'min(transactionAmountUSD)',
  true
)
const AverageTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.AVERAGE_TRANSACTION_AMOUNT,
  'Average transaction amount',
  () => 'avg(transactionAmountUSD)',
  true
)

const MedianTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MEDIAN_TRANSACTION_AMOUNT,
  'Median transaction amount',
  () => 'approx_percentile(transactionAmountUSD, 0.5)',
  true
)

const TotalTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TOTAL_TRANSACTION_AMOUNT,
  'Total transaction amount',
  () => 'sum(transactionAmountUSD)',
  true
)

export const TransactionAggregations = [
  TrsScore,
  TransactionCount,
  AverageTransactionAmount,
  MaxTransactionAmount,
  MinTransactionAmount,
  MedianTransactionAmount,
  TotalTransactionAmount,
]
