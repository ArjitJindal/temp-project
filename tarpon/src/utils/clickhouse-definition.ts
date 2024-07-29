import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { RULE_ACTIONS } from '@/@types/openapi-public-custom/RuleAction'
import { TRANSACTION_STATES } from '@/@types/openapi-public-custom/TransactionState'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'

export type TableDefinition = {
  table: string
  idColumn: string
  timestampColumn: string
  materializedColumns?: string[]
  projections?: { name: string; key: string }[]
}

const enumFields = (
  enumValues: string[],
  fieldNameFrom: string,
  fieldNameTo: string
): string => {
  const enumType = enumValues.length <= 16 ? 'Enum8' : 'Enum'
  const nullableEnumValues = enumValues
    .map((m, i) => `'${m}' = ${i}`)
    .concat(`'' = ${enumValues.length}`)
    .join(', ')

  const type = `Nullable(${enumType}(${nullableEnumValues}))`
  const jsonExtractType = `Nullable(${enumType}(${enumValues
    .map((m, i) => `\\'${m}\\' = ${i}`)
    .concat(`\\'\\' = ${enumValues.length}`)
    .join(', ')}))`

  return `${fieldNameTo} ${type} MATERIALIZED JSONExtract(data, '${fieldNameFrom
    .split('.')
    .join("', '")}', '${jsonExtractType}')`
}

export const ClickHouseTables: TableDefinition[] = [
  {
    table: 'transactions',
    idColumn: 'transactionId',
    timestampColumn: 'timestamp',
    materializedColumns: [
      enumFields(
        PAYMENT_METHODS,
        'originPaymentDetails.method',
        'originPaymentMethod'
      ),
      enumFields(
        PAYMENT_METHODS,
        'destinationPaymentDetails.method',
        'destinationPaymentMethod'
      ),
      "originUserId String MATERIALIZED JSON_VALUE(data, '$.originUserId')",
      "destinationUserId String MATERIALIZED JSON_VALUE(data, '$.destinationUserId')",
      enumFields(RULE_ACTIONS, 'status', 'status'),
      "productType String MATERIALIZED JSON_VALUE(data, '$.productType')",
      enumFields(TRANSACTION_TYPES, 'type', 'type'),
      "originAmountDetails_country LowCardinality(FixedString(2)) MATERIALIZED JSONExtract(data, 'originAmountDetails', 'country', 'LowCardinality(FixedString(2))')",
      "destinationAmountDetails_country LowCardinality(FixedString(2)) MATERIALIZED JSONExtract(data, 'destinationAmountDetails', 'country', 'LowCardinality(FixedString(2))')",
      "tags Array(Tuple(key String, value String)) MATERIALIZED JSONExtract(JSONExtractRaw(data, 'tags'), 'Array(Tuple(key String, value String))')",
      "arsScore_arsScore Float32 MATERIALIZED JSONExtractFloat(data, 'arsScore', 'arsScore')",
      "ruleInstancesHit Array(String) MATERIALIZED arrayMap(x -> JSONExtractString(x, 'ruleInstanceId'), JSONExtractArrayRaw(data, 'hitRules'))",
      "ruleInstancesExecuted Array(String) MATERIALIZED arrayMap(x -> JSONExtractString(x, 'ruleInstanceId'), JSONExtractArrayRaw(data, 'executedRules'))",
      "originAmountDetails_transactionAmount Float32 MATERIALIZED JSONExtractFloat(data, 'originAmountDetails', 'transactionAmount')",
      "originAmountDetails_transactionCurrency LowCardinality(FixedString(3)) MATERIALIZED JSONExtract(data, 'originAmountDetails', 'transactionCurrency', 'LowCardinality(FixedString(3))')",
      "destinationAmountDetails_transactionAmount Float32 MATERIALIZED JSONExtractFloat(data, 'destinationAmountDetails', 'transactionAmount')",
      "destinationAmountDetails_transactionCurrency LowCardinality(FixedString(3)) MATERIALIZED JSONExtract(data, 'destinationAmountDetails', 'transactionCurrency', 'LowCardinality(FixedString(3))')",
      enumFields(TRANSACTION_STATES, 'transactionState', 'transactionState'),
    ],
    projections: [{ name: 'projection_by_timestamp_v1', key: 'timestamp' }],
  },
  {
    table: 'users',
    idColumn: 'userId',
    timestampColumn: 'createdTimestamp',
  },
  {
    table: 'transaction_events',
    idColumn: 'eventId',
    timestampColumn: 'timestamp',
  },
  {
    table: 'user_events',
    idColumn: 'eventId',
    timestampColumn: 'timestamp',
  },
] as const

export type TableName = (typeof ClickHouseTables)[number]['table']
