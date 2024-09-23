import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { PropertiesQuestion } from '@/services/copilot/questions/types'
import {
  currencyDefault,
  currencyVars,
  Direction,
  directionDefault,
  directionVars,
  humanReadablePeriod,
  transactionPaymentIdentifierQuerySQL,
  Period,
  periodDefaults,
  periodVars,
  sqlPeriod,
  paymentIdentifierQueryClickhouse,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/viper'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getContext } from '@/core/utils/context'
import {
  executeClickhouseQuery,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'

type TransactionSummary = {
  count: number
  min: number
  max: number
  total: number
  avg: number
}

export const TransactionSummary: PropertiesQuestion<
  Period & { currency: CurrencyCode; direction: Direction }
> = {
  type: 'PROPERTIES',
  questionId: COPILOT_QUESTIONS.TRANSACTION_INSIGHTS,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async ({ humanReadableId }, { direction, ...period }) => {
    return `Transaction insights for ${humanReadableId} as ${direction.toLowerCase()} ${humanReadablePeriod(
      period
    )} as originator`
  },
  aggregationPipeline: async (
    { convert, userId, paymentIdentifier },
    { direction, currency, ...period }
  ) => {
    let result: TransactionSummary
    if (isClickhouseEnabled()) {
      const condition = userId
        ? `{{ userIdKey }} = '{{ userId }}'`
        : paymentIdentifierQueryClickhouse(paymentIdentifier, direction)

      const query = `
      SELECT
        count(*) as count,
        min(originAmountDetails_amountInUsd) as min,
        max(originAmountDetails_amountInUsd) as max,
        sum(originAmountDetails_amountInUsd) as total,
        avg(originAmountDetails_amountInUsd) as avg
      FROM transactions
      WHERE
        ${condition}
        and timestamp between {{ from }} and {{ to }}
      `

      const response = await executeClickhouseQuery<{
        count: number
        min: number
        max: number
        total: number
        avg: number
      }>(getContext()?.tenantId as string, query, {
        userId,
        from: period.from?.toString() ?? '',
        to: period.to?.toString() ?? '',
        userIdKey:
          direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId',
      })

      result = response[0]
    } else {
      const userIdKey =
        direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
      const condition = userId
        ? `t.${userIdKey} = :userId`
        : transactionPaymentIdentifierQuerySQL(paymentIdentifier, direction)
      const raw = await executeSql<TransactionSummary>(
        `
    select
      count(*) as count,
      coalesce(min(t.transactionAmountUSD), 0) as min,
      coalesce(max(t.transactionAmountUSD), 0) as max,
      coalesce(sum(t.transactionAmountUSD), 0) as total,
      coalesce(avg(t.transactionAmountUSD), 0) as avg
    from
      transactions t
      where ${condition}
        and t.timestamp between :from and :to
    `,
        { userId, ...sqlPeriod(period), ...paymentIdentifier }
      )

      result = raw[0]
    }

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
