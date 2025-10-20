import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import {
  matchPeriodSQL,
  Period,
} from '@/services/copilot/questions/definitions/util'

export function buildPaymentIdentifierQuery(
  directionSmall: string,
  orderByClause: string,
  userId: string,
  period: Period
): string {
  const paymentMethodColumn =
    directionSmall === 'from'
      ? 'originPaymentMethod'
      : 'destinationPaymentMethod'
  const paymentMethodIdColumn =
    directionSmall === 'from'
      ? 'originPaymentMethodId'
      : 'destinationPaymentMethodId'
  const paymentDetailsNamePath =
    directionSmall === 'from'
      ? 'originPaymentDetailsName'
      : 'destinationPaymentDetailsName'
  const userIdColumn =
    directionSmall === 'from' ? 'originUserId' : 'destinationUserId'

  return `
    SELECT
      any(${paymentMethodColumn}) AS paymentMethod,
      count(*) AS count,
      sum(originAmountDetails_amountInUsd) AS sum,
      sum(originAmountDetails_amountInUsd) / count(*) AS average,
      max(originAmountDetails_amountInUsd) AS max,
      min(originAmountDetails_amountInUsd) AS min,
      ${paymentMethodIdColumn} AS paymentIdentifier,
      arrayDistinct(
        arrayFilter(x -> x != '', arrayFlatten(groupArray(names)))
      ) AS names
    FROM (
      SELECT
        ${paymentMethodIdColumn},
        ${paymentMethodColumn},
        originAmountDetails_amountInUsd,
        ${paymentDetailsNamePath} AS names
      FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
      WHERE
        ${userIdColumn} = '${userId}'
        AND ${matchPeriodSQL('timestamp', period)}
    ) AS pre_aggregated
    GROUP BY ${paymentMethodIdColumn}
    ${orderByClause}
  `
}
