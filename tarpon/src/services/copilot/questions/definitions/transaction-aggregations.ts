import { COPILOT_QUESTIONS, QuestionId } from '@flagright/lib/utils'
import { startCase } from 'lodash'
import {
  InvestigationContext,
  TimeseriesQuestion,
} from '@/services/copilot/questions/types'
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
  paymentIdentifierQueryClickhouse,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/viper'
import dayjs from '@/utils/dayjs'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { notEmpty } from '@/utils/array'
import { getContext, hasFeature } from '@/core/utils/context'
import { getClickhouseClient } from '@/utils/clickhouse/utils'

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
  const startOf = `toStartOf${startCase(sqlGranularity.toLowerCase())}`

  const query = `
  SELECT
    toDate(${startOf}(toDateTime(timestamp / 1000))) as date,
    round(${aggregationExpression(granularity)}, 2) as agg
  FROM transactions
  WHERE 
  (
    (toDateTime(timestamp / 1000) >= fromUnixTimestamp64Milli(${
      period.from
    }) AND toDateTime(timestamp / 1000) <= fromUnixTimestamp64Milli(${
    period.to
  }))
    AND ${clickhouseCondition}
  )
  GROUP BY date
  ORDER BY date ASC
  WITH FILL FROM toDate(${startOf}(toDateTime(${
    period.from
  } / 1000))) TO toDate(${startOf}(toDateTime(${
    period.to
  } / 1000))) + INTERVAL 1 ${sqlGranularity} STEP INTERVAL 1 ${sqlGranularity}
  SETTINGS output_format_json_quote_64bit_integers = 0
`

  return query
}

export const transactionAggregationQuestion = (
  questionId: QuestionId,
  title: string,
  aggregationExpression: (granularity: TimeGranularity) => string,
  clickhouseAggregationExpression: (granularity: TimeGranularity) => string,
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
  questionId,
  version: 2,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async (_, vars) => `${title} ${humanReadablePeriod(vars)}`,
  aggregationPipeline: async (
    ctx,
    { granularity, currency, showUserLimit, ...period }
  ) => {
    let values: { time: number; value: number }[] = []

    if (hasFeature('CLICKHOUSE_ENABLED')) {
      values = await getClickhouseData(
        ctx,
        period,
        granularity,
        clickhouseAggregationExpression,
        currency ?? 'USD'
      )
    } else {
      values = await getSQLData(
        ctx,
        period,
        granularity,
        aggregationExpression,
        currency ?? 'USD',
        joins
      )
    }

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
          label: "User's transactions limits",
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
  const queryResult = await clickhouseClient.query({
    query,
    format: 'JSONEachRow',
  })

  const result = await queryResult.json<{ date: string; agg: number }>()
  return result.map((row) => ({
    time: dayjs(row.date).valueOf(),
    value: currency ? ctx.convert(row.agg, currency) : row.agg,
  }))
}

async function getSQLData(
  ctx: InvestigationContext,
  period: Period,
  granularity: TimeGranularity,
  aggregationExpression: (granularity: TimeGranularity) => string,
  currency: CurrencyCode,
  joins: string
) {
  const sqlExpression = timeXAxis(granularity)
  const condition = ctx.userId
    ? `t.originUserId = :userId OR t.destinationUserId = :userId`
    : transactionPaymentIdentifierQuerySQL(ctx.paymentIdentifier)

  const rows = await executeSql<{
    timestamp: number
    date: string
    agg: number
  }>(
    getSQLQuery(
      sqlExpression,
      aggregationExpression,
      granularity,
      condition,
      joins
    ),
    {
      userId: ctx.userId,
      from: dayjs(period.from).format('YYYY-MM-DD'),
      to: dayjs(period.to).format('YYYY-MM-DD'),
      ...ctx.paymentIdentifier,
    }
  )

  return rows.map((row) => ({
    time: row.timestamp,
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

function getSQLQuery(
  sqlExpression: string,
  aggregationExpression: (granularity: TimeGranularity) => string,
  granularity: TimeGranularity,
  condition: string,
  joins: string
) {
  return `
    , DateSeries AS (
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
  `
}

const TrsScore = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRS_SCORE,
  'TRS score distribution',
  () => 'avg(ar.arsScore)',
  () => 'avg(arsScore_arsScore)',
  false,
  'left join action_risk_values ar on ar.transactionId = t.transactionId'
)

const TransactionCount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TRANSACTION_COUNT,
  'Transaction count',
  () => 'count(t.transactionId)',
  () => 'count()'
)

const MaxTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MAX_TRANSACTION_AMOUNT,
  'Max transaction amount',
  () => 'max(transactionAmountUSD)',
  () => 'max(originAmountDetails_amountInUsd)',
  true
)

const MinTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MIN_TRANSACTION_AMOUNT,
  'Min transaction amount',
  () => 'min(transactionAmountUSD)',
  () => 'min(originAmountDetails_amountInUsd)',
  true
)
const AverageTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.AVERAGE_TRANSACTION_AMOUNT,
  'Average transaction amount',
  () => 'avg(transactionAmountUSD)',
  () => 'avg(originAmountDetails_amountInUsd)',
  true
)

const MedianTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.MEDIAN_TRANSACTION_AMOUNT,
  'Median transaction amount',
  () => 'approx_percentile(transactionAmountUSD, 0.5)',
  () => 'median(originAmountDetails_amountInUsd)',
  true
)

const TotalTransactionAmount = transactionAggregationQuestion(
  COPILOT_QUESTIONS.TOTAL_TRANSACTION_AMOUNT,
  'Total transaction amount',
  () => 'sum(transactionAmountUSD)',
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
