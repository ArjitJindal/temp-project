import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import {
  matchPeriodSQL,
  paymentIdentifierQueryClickhouse,
  Period,
} from '@/services/copilot/questions/definitions/util'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export function buildTransactionTypeQuery(
  userId: string | undefined,
  paymentIdentifier: PaymentDetails | undefined,
  period: Period
): string {
  const identifierQuery = userId
    ? `(originUserId = '${userId}' OR destinationUserId = '${userId}')`
    : paymentIdentifierQueryClickhouse(paymentIdentifier)

  return `
    SELECT type, count() as count
    FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
    WHERE
    ${matchPeriodSQL('timestamp', period)} AND
    ${identifierQuery}
    GROUP BY type
    SETTINGS output_format_json_quote_64bit_integers = 0
  `
}
