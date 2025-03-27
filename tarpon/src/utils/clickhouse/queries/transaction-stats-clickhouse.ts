import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'
import { RULE_ACTIONS } from '@/@types/openapi-public-custom/RuleAction'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'

export const getTransactionStatsClickhouseMVQuery = (timeFormat: string) => {
  const query = `
    SELECT 
      ${timeFormat} AS time,
      ${buildQueryPart(
        PAYMENT_METHODS,
        'paymentMethods',
        'originPaymentMethod',
        'destinationPaymentMethod'
      )},
      ${buildQueryPart(TRANSACTION_TYPES, 'transactionType', 'type')},
      ${buildQueryPart(RULE_ACTIONS, 'status', 'status')},
      ${buildQueryPart(RISK_LEVELS, 'arsRiskLevel', 'arsScore_riskLevel')}
    FROM transactions
    WHERE toDateTime(timestamp / 1000) > toDateTime(0)
    GROUP BY time;
  `
  return query
}
export const transactionStatsColumns = [
  { name: 'time', type: 'DateTime' },
  ...PAYMENT_METHODS.map((pm) => ({
    name: `paymentMethods_${pm}`,
    type: 'UInt64',
  })),
  ...TRANSACTION_TYPES.map((tt) => ({
    name: `transactionType_${tt}`,
    type: 'UInt64',
  })),
  ...RULE_ACTIONS.map((ra) => ({
    name: `status_${ra}`,
    type: 'UInt64',
  })),
  ...RISK_LEVELS.map((rl) => ({
    name: `arsRiskLevel_${rl}`,
    type: 'UInt64',
  })),
]
export function buildQueryPart(
  items: string[],
  aliasPrefix: string,
  ...fields: string[]
): string {
  return items
    .map(
      (item) =>
        fields.map((field) => `COUNTIf(${field} = '${item}')`).join(' + ') +
        ` as ${aliasPrefix}_${item}`
    )
    .join(', ')
}
