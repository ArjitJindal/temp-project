import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import {
  matchPeriodSQL,
  paymentIdentifierQueryClickhouse,
  Period,
} from '@/services/copilot/questions/definitions/util'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export type TransactionAggregationsResult = {
  trsScore: number
  transactionCount: number
  maxTransactionAmount: number
  minTransactionAmount: number
  averageTransactionAmount: number
  medianTransactionAmount: number
  totalTransactionAmount: number
}

export function buildTransactionAggregationsQuery(
  userId: string | undefined,
  paymentIdentifier: PaymentDetails | undefined,
  period: Period
): string {
  const identifierQuery = userId
    ? `(originUserId = '${userId}' OR destinationUserId = '${userId}')`
    : paymentIdentifierQueryClickhouse(paymentIdentifier)

  return `
    SELECT
      avg(arsScore_arsScore) as trsScore,
      count() as transactionCount,
      max(originAmountDetails_amountInUsd) as maxTransactionAmount,
      min(originAmountDetails_amountInUsd) as minTransactionAmount,
      avg(originAmountDetails_amountInUsd) as averageTransactionAmount,
      median(originAmountDetails_amountInUsd) as medianTransactionAmount,
      sum(originAmountDetails_amountInUsd) as totalTransactionAmount
    FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
    WHERE
    ${matchPeriodSQL('timestamp', period)} AND
    ${identifierQuery}
    SETTINGS output_format_json_quote_64bit_integers = 0
  `
}
