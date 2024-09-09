import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { RULE_ACTIONS } from '@/@types/openapi-public-custom/RuleAction'
import { TRANSACTION_STATES } from '@/@types/openapi-public-custom/TransactionState'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'

type BaseTableDefinition = {
  table: string
  idColumn: string
  timestampColumn: string
  materializedColumns?: string[]
  engine: 'ReplacingMergeTree'
  primaryKey: string
  orderBy: string
  partitionBy?: string
  mongoIdColumn?: boolean
}

export type MaterializedViewDefinition = Omit<
  BaseTableDefinition,
  'idColumn' | 'timestampColumn' | 'projections' | 'materializedColumns'
> & {
  viewName: string
  columns: string[]
}

export type ProjectionsDefinition = {
  name: string
  version: number
  definition: {
    columns: string[]
    aggregator: 'GROUP'
    aggregatorBy: string
  }
}

export type ClickhouseTableDefinition = BaseTableDefinition & {
  materializedViews?: MaterializedViewDefinition[]
  projections?: ProjectionsDefinition[]
}

const enumFields = (
  enumValues: string[],
  fieldNameFrom: string,
  fieldNameTo: string
): string => {
  const enumType = enumValues.length <= 16 ? 'Enum8' : 'Enum'
  const nullableEnumValues = enumValues.map((m, i) => `'${m}' = ${i + 1}`)
  nullableEnumValues.unshift(`'' = 0`)
  const nullableEnumValuesString = nullableEnumValues.join(', ')

  const type = `${enumType}(${nullableEnumValuesString})`
  const jsonExtract = enumValues.map((m, i) => `\\'${m}\\' = ${i + 1}`)
  jsonExtract.unshift(`\\'\\' = 0`)
  const jsonExtractType = `${enumType}(${jsonExtract.join(', ')})`

  return `${fieldNameTo} ${type} MATERIALIZED JSONExtract(data, '${fieldNameFrom
    .split('.')
    .join("', '")}', '${jsonExtractType}')`
}

export const CLICKHOUSE_DEFINITIONS = {
  TRANSACTIONS: {
    tableName: 'transactions',
    definition: {
      idColumn: 'transactionId',
      timestampColumn: 'timestamp',
    },
    materializedViews: {
      BY_ID: {
        viewName: 'transactions_by_id_mv',
        table: 'transactions_by_id',
      },
    },
  },
  USERS: {
    tableName: 'users',
  },
  TRANSACTION_EVENTS: {
    tableName: 'transaction_events',
  },
  USER_EVENTS: {
    tableName: 'user_events',
  },
  CASES: {
    tableName: 'cases',
  },
}

export const ClickHouseTables: ClickhouseTableDefinition[] = [
  {
    table: CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
    idColumn: CLICKHOUSE_DEFINITIONS.TRANSACTIONS.definition.idColumn,
    timestampColumn:
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.definition.timestampColumn,
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
      "originAmountDetails_country LowCardinality(String) MATERIALIZED JSONExtract(data, 'originAmountDetails', 'country', 'LowCardinality(FixedString(2))')",
      "destinationAmountDetails_country LowCardinality(String) MATERIALIZED JSONExtract(data, 'destinationAmountDetails', 'country', 'LowCardinality(FixedString(2))')",
      "tags Array(Tuple(key String, value String)) MATERIALIZED JSONExtract(JSONExtractRaw(data, 'tags'), 'Array(Tuple(key String, value String))')",
      enumFields(RISK_LEVELS, 'arsScore.riskLevel', 'arsScore_riskLevel'),
      "arsScore_arsScore Float32 MATERIALIZED JSONExtractFloat(data, 'arsScore', 'arsScore')",
      "ruleInstancesHit Array(String) MATERIALIZED arrayMap(x -> JSONExtractString(x, 'ruleInstanceId'), JSONExtractArrayRaw(data, 'hitRules'))",
      "ruleInstancesExecuted Array(String) MATERIALIZED arrayMap(x -> JSONExtractString(x, 'ruleInstanceId'), JSONExtractArrayRaw(data, 'executedRules'))",
      "originAmountDetails_transactionAmount Float32 MATERIALIZED JSONExtractFloat(data, 'originAmountDetails', 'transactionAmount')",
      "originAmountDetails_transactionCurrency LowCardinality(String) MATERIALIZED JSONExtract(data, 'originAmountDetails', 'transactionCurrency', 'LowCardinality(FixedString(3))')",
      "destinationAmountDetails_transactionAmount Float32 MATERIALIZED JSONExtractFloat(data, 'destinationAmountDetails', 'transactionAmount')",
      "destinationAmountDetails_transactionCurrency LowCardinality(String) MATERIALIZED JSONExtract(data, 'destinationAmountDetails', 'transactionCurrency', 'LowCardinality(FixedString(3))')",
      enumFields(TRANSACTION_STATES, 'transactionState', 'transactionState'),
      "originPaymentMethodId String MATERIALIZED JSON_VALUE(data, '$.originPaymentMethodId')",
      "destinationPaymentMethodId String MATERIALIZED JSON_VALUE(data, '$.destinationPaymentMethodId')",
    ],
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    partitionBy: 'toYYYYMM(toDateTime(timestamp / 1000))',
    mongoIdColumn: true,
    materializedViews: [
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_ID.viewName,
        columns: ['id String', 'data String'],
        engine: 'ReplacingMergeTree',
        primaryKey: 'id',
        orderBy: 'id',
        table:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_ID.table,
      },
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.USERS.tableName,
    idColumn: 'userId',
    timestampColumn: 'createdTimestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    mongoIdColumn: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName,
    idColumn: 'eventId',
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    mongoIdColumn: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.USER_EVENTS.tableName,
    idColumn: 'eventId',
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    mongoIdColumn: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.CASES.tableName,
    idColumn: 'caseId',
    timestampColumn: 'createdTimestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    mongoIdColumn: true,
  },
] as const

export type TableName = (typeof ClickHouseTables)[number]['table']
