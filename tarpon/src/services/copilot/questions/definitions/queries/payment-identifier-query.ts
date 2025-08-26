import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
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
  const paymentDetailsPath =
    directionSmall === 'from'
      ? 'originPaymentDetails'
      : 'destinationPaymentDetails'
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
        CASE
          WHEN ${paymentMethodColumn} = 'CARD' THEN trimBoth(replaceRegexpAll(CONCAT(
            JSONExtractString(data, '${paymentDetailsPath}', 'nameOnCard', 'firstName'),
            ' ',
            JSONExtractString(data, '${paymentDetailsPath}', 'nameOnCard', 'middleName'),
            ' ',
            JSONExtractString(data, '${paymentDetailsPath}', 'nameOnCard', 'lastName')
          ),
          '\\s+',
          ' '
        ))
          WHEN ${paymentMethodColumn} = 'NPP' THEN trimBoth(replaceRegexpAll(CONCAT(
            JSONExtractString(data, '${paymentDetailsPath}', 'name', 'firstName'),
            ' ',
            JSONExtractString(data, '${paymentDetailsPath}', 'name', 'middleName'),
            ' ',
            JSONExtractString(data, '${paymentDetailsPath}', 'name', 'lastName')
          ),
          '\\s+',
          ' '
        ))
          ELSE trimBoth(JSONExtractString(data, '${paymentDetailsPath}', 'name'))
        END AS names
      FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
      WHERE
        ${userIdColumn} = '${userId}'
        AND ${matchPeriodSQL('timestamp', period)}
    ) AS pre_aggregated
    GROUP BY ${paymentMethodIdColumn}
    ${orderByClause}
  `
}
