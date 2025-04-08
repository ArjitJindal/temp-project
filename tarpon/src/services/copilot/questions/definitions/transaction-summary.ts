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
  paymentIdentifierQueryClickhouse,
} from '@/services/copilot/questions/definitions/util'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getContext } from '@/core/utils/context-storage'
import {
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

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
    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

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
      FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
      WHERE
        ${condition}
        and timestamp between {{ from }} and {{ to }}
      `

    const response = await executeClickhouseQuery<TransactionSummary[]>(
      getContext()?.tenantId as string,
      query,
      {
        userId,
        from: period.from?.toString() ?? '',
        to: period.to?.toString() ?? '',
        userIdKey:
          direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId',
      }
    )

    const result = response[0]

    return {
      data: [
        { key: 'Transaction count', value: result.count.toFixed(0) },
        { key: 'Max amount', value: convert(result.max, currency).toFixed(2) },
        { key: 'Min amount', value: convert(result.min, currency).toFixed(2) },
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
