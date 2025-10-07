import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import {
  InvestigationContext,
  TimeseriesQuestion,
} from '@/services/copilot/questions/types'
import {
  currencyDefault,
  currencyVars,
  GRANULARITIES,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
  TimeGranularity,
  paymentIdentifierQueryClickhouse,
} from '@/services/copilot/questions/definitions/util'
import dayjs from '@/utils/dayjs'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { notEmpty } from '@/utils/array'
import { getContext } from '@/core/utils/context-storage'
import { executeClickhouseQuery } from '@/utils/clickhouse/execute'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'

export const getClickhouseQuery = (
  period: Period,
  granularity: TimeGranularity,
  aggregationExpression: (granularity: TimeGranularity) => string,
  clickhouseCondition: string
) => {
  let sqlGranularity = 'DAY'

  switch (granularity) {
    case 'Daily':
      sqlGranularity = 'DAY'
      break
    case 'Weekly':
      sqlGranularity = 'WEEK'
      break
    case 'Monthly':
      sqlGranularity = 'MONTH'
      break
    case 'Quarterly':
      sqlGranularity = 'QUARTER'
      break
    case 'Yearly':
      sqlGranularity = 'YEAR'
      break
  }
  const query = `
    SELECT
      toDate(timestamp / 1000) as date,
      round(${aggregationExpression(granularity)}, 2) as agg
    FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
    PREWHERE
    (
      (timestamp >= ${period.from} AND timestamp <= ${period.to})
      AND (${clickhouseCondition})
    )
    GROUP BY date
    ORDER BY date ASC
    WITH FILL FROM toDate(${period.from} / 1000)
    TO toDate(${period.to} / 1000) + INTERVAL 1 ${sqlGranularity} 
    STEP INTERVAL 1 ${sqlGranularity}
    SETTINGS output_format_json_quote_64bit_integers = 0
  `

  return query
}

export const transactionAggregationQuestion = (
  questionId: QuestionId,
  title: string,
  clickhouseAggregationExpression: (granularity: TimeGranularity) => string,
  showCurrency = false
): TimeseriesQuestion<
  Period & {
    granularity: TimeGranularity
    currency?: CurrencyCode
    showUserLimit: boolean
  }
> => ({
  type: 'TIME_SERIES',
  questionId,
  version: 2,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async (_, vars) => `${title} ${humanReadablePeriod(vars)}`,
  aggregationPipeline: async (
    ctx,
    { granularity, currency, showUserLimit, ...period }
  ) => {
    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

    const values = await getClickhouseData(
      ctx,
      period,
      granularity,
      clickhouseAggregationExpression,
      currency ?? 'USD'
    )

    const userLimitValues = getUserLimitValues(
      ctx,
      granularity,
      showUserLimit,
      values,
      currency
    )

    return {
      data: [
        { label: '', values },
        userLimitValues && {
          label: "{{UserAlias}}'s transactions limits",
          values: userLimitValues,
        },
      ].filter(notEmpty),
      summary: '',
    }
  },
  variableOptions: {
    ...periodVars,
    ...(showCurrency ? currencyVars : {}),
    granularity: {
      type: 'AUTOCOMPLETE',
      options: () => GRANULARITIES,
    },
    showUserLimit: 'BOOLEAN',
  },
  defaults: () => ({
    ...periodDefaults(),
    ...currencyDefault,
    granularity: 'Daily',
    showUserLimit: false,
  }),
})

async function getClickhouseData(
  ctx: InvestigationContext,
  period: Period,
  granularity: TimeGranularity,
  clickhouseAggregationExpression: (granularity: TimeGranularity) => string,
  currency: CurrencyCode
) {
  const clickhouseCondition = ctx.userId
    ? `originUserId = '${ctx.userId}' OR destinationUserId = '${ctx.userId}'`
    : paymentIdentifierQueryClickhouse(ctx.paymentIdentifier)
  const query = getClickhouseQuery(
    period,
    granularity,
    clickhouseAggregationExpression,
    clickhouseCondition
  )

  const tenantId = getContext()?.tenantId as string
  const clickhouseClient = await getClickhouseClient(tenantId)
  const result = await executeClickhouseQuery<
    Array<{ date: string; agg: number }>
  >(clickhouseClient, {
    query,
    format: 'JSONEachRow',
  })

  return result.map((row) => ({
    time: dayjs(row.date).valueOf(),
    value: currency ? ctx.convert(row.agg, currency) : row.agg,
  }))
}

function getUserLimitValues(ctx, granularity, showUserLimit, values, currency) {
  if (!showUserLimit) {
    return null
  }

  const limitKey =
    `maximum${granularity}TransactionLimit` as keyof typeof ctx.user.transactionLimits
  const limit = ctx.user?.transactionLimits?.[limitKey]

  if (limit && values.length > 0) {
    const currencyLimit = currency
      ? ctx.convert(limit.amountValue, currency)
      : limit.amountValue
    return values.map((x) => ({ ...x, value: currencyLimit }))
  }

  return null
}

const TrsScore = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRS_SCORE,
  'TRS score distribution',
  () => 'avg(arsScore_arsScore)',
  false
)

const TransactionCount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRANSACTION_COUNT,
  'Transaction count',
  () => 'count()'
)

const MaxTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MAX_TRANSACTION_AMOUNT,
  'Max transaction amount',
  () => 'max(originAmountDetails_amountInUsd)',
  true
)

const MinTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MIN_TRANSACTION_AMOUNT,
  'Min transaction amount',
  () => 'min(originAmountDetails_amountInUsd)',
  true
)
const AverageTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.AVERAGE_TRANSACTION_AMOUNT,
  'Average transaction amount',
  () => 'avg(originAmountDetails_amountInUsd)',
  true
)

const MedianTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MEDIAN_TRANSACTION_AMOUNT,
  'Median transaction amount',
  () => 'median(originAmountDetails_amountInUsd)',
  true
)

const TotalTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TOTAL_TRANSACTION_AMOUNT,
  'Total transaction amount',
  () => 'sum(originAmountDetails_amountInUsd)',
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
