import { invert, memoize, uniq } from 'lodash'
import { MONGO_TABLE_SUFFIX_MAP } from '../mongodb-definitions'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { RULE_ACTIONS } from '@/@types/openapi-public-custom/RuleAction'
import { TRANSACTION_STATES } from '@/@types/openapi-public-custom/TransactionState'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'
import { USER_TYPES } from '@/@types/user/user-type'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'
import { SANCTIONS_SCREENING_ENTITYS } from '@/@types/openapi-internal-custom/SanctionsScreeningEntity'

export type IndexOptions = {
  type: string
  config: Record<string, any>
}

export type IndexType =
  | 'inverted'
  | 'normal'
  | 'bloom_filter'
  | 'minmax'
  | 'set'
  | 'tokenbf_v1'

type BaseTableDefinition = {
  table: string
  idColumn: string
  timestampColumn: string
  materializedColumns?: string[]
  indexes?: {
    column: string
    name: string
    type: IndexType
    options: {
      granularity: number
      ngramSize?: number
      bloomFilterSize?: number
      numHashFunctions?: number
      randomSeed?: number
    }
  }[]
  engine: 'ReplacingMergeTree'
  primaryKey: string
  orderBy: string
  partitionBy?: string
  mongoIdColumn?: boolean
  optimize?: boolean
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

const generatePaymentDetailColumns = (prefix: string) =>
  uniq(
    Object.values(PAYMENT_METHOD_IDENTIFIER_FIELDS)
      .flat()
      .map(
        (field) =>
          `${prefix}PaymentDetails_${field} String MATERIALIZED JSONExtractString(data, '${prefix}PaymentDetails', '${field}')`
      )
  )

const userNameMaterilizedColumn = `username String MATERIALIZED 
        IF(
        JSON_VALUE(data, '$.type') = 'CONSUMER', 
        COALESCE(
            CONCAT(
                COALESCE(JSON_VALUE(data, '$.userDetails.name.firstName'), ''),
                ' ',
                COALESCE(JSON_VALUE(data, '$.userDetails.name.middleName'), ''),
                ' ',
                COALESCE(JSON_VALUE(data, '$.userDetails.name.lastName'), '')
            ),
            ''
        ),
        JSON_VALUE(data, '$.legalEntity.companyGeneralDetails.legalName')
    )`

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
    definition: {
      idColumn: 'userId',
      timestampColumn: 'createdTimestamp',
    },
    materializedViews: {
      BY_ID: {
        viewName: 'users_by_id_mv',
        table: 'users_by_id',
      },
    },
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
  KRS_SCORE: {
    tableName: 'krs_score',
  },
  DRS_SCORE: {
    tableName: 'drs_score',
  },
  ARS_SCORE: {
    tableName: 'ars_score',
  },
  SANCTIONS_SCREENING_DETAILS: {
    tableName: 'sanctions_screening_details',
  },
  ALERTS: {
    tableName: 'alerts',
  },
  NANGO_RECORDS: {
    tableName: 'nango_records',
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
      ...generatePaymentDetailColumns('origin'),
      ...generatePaymentDetailColumns('destination'),
      "originAmountDetails_amountInUsd Float32 MATERIALIZED JSONExtractFloat(data, 'originAmountDetails', 'amountInUsd')",
      "destinationAmountDetails_amountInUsd Float32 MATERIALIZED JSONExtractFloat(data, 'destinationAmountDetails', 'amountInUsd')",
      "reference String MATERIALIZED JSON_VALUE(data, '$.reference')",
    ],
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, originUserId, destinationUserId, id)',
    orderBy: '(timestamp, originUserId, destinationUserId, id)',
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
    optimize: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.USERS.tableName,
    idColumn: CLICKHOUSE_DEFINITIONS.USERS.definition.idColumn,
    timestampColumn: CLICKHOUSE_DEFINITIONS.USERS.definition.timestampColumn,
    materializedColumns: [
      enumFields(USER_TYPES, 'type', 'type'),
      `emailIds Array(String) MATERIALIZED arrayConcat(
        JSONExtractArrayRaw(data, 'contactDetails', 'emailIds'),
        JSONExtractArrayRaw(data, 'legalEntity', 'contactDetails', 'emailIds')
      )`,
      `emailIds_tokens Array(String) MATERIALIZED arrayMap(x -> lower(x), emailIds)`,
      userNameMaterilizedColumn,
      `tags Array(Tuple(key String, value String)) MATERIALIZED JSONExtract(JSONExtractRaw(data, 'tags'), 'Array(Tuple(key String, value String))')`,
      `pepDetails Array(Tuple(isPepHit Bool, pepCountry String, pepRank String)) MATERIALIZED JSONExtract(JSONExtractRaw(data, 'pepStatus'), 'Array(Tuple(isPepHit Bool, pepCountry String, pepRank String))')`,
      `documentIds Array(String) MATERIALIZED arrayMap(x -> JSONExtractString(x, 'documentNumber'), JSONExtractArrayRaw(data, 'legalDocuments'))`,
      `nationality String MATERIALIZED JSONExtractString(data, '$.userDetails.countryOfNationality')`,
      `userRegistrationStatus Nullable(String) MATERIALIZED 
        CASE
            WHEN JSON_VALUE(data, '$.type') = 'BUSINESS' THEN 
                JSON_VALUE(data, '$.legalEntity.companyGeneralDetails.userRegistrationStatus')
            ELSE NULL
        END`,
      `riskLevelLocked Nullable(String) MATERIALIZED 
      CASE
          WHEN JSON_VALUE(data, '$.drsScore.isUpdatable') = 'true' THEN 'No'
          WHEN JSON_VALUE(data, '$.drsScore.isUpdatable') = 'false' THEN 'Yes'
          ELSE NULL
      END`,
      `craRiskLevel Nullable(String) MATERIALIZED JSON_VALUE(data, '$.drsScore.manualRiskLevel')`,
      `drsScore_drsScore Float64 MATERIALIZED JSONExtractFloat(data, 'drsScore', 'drsScore')`,
      `krsScore_krsScore Float64 MATERIALIZED JSONExtractFloat(data, 'krsScore', 'krsScore')`,
      `updatedAt Nullable(UInt64) MATERIALIZED toUInt64OrNull(JSON_VALUE(data, '$.updatedAt'))`,
      `userStateDetails_state String MATERIALIZED JSONExtractString(data, 'userStateDetails', 'state')`,
      `kycStatusDetails_status String MATERIALIZED JSONExtractString(data, 'kycStatusDetails', 'status')`,
    ],
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    indexes: [
      {
        column: 'username',
        name: 'username_idx',
        type: 'tokenbf_v1',
        options: {
          granularity: 4,
          ngramSize: 3,
          bloomFilterSize: 512,
          numHashFunctions: 5,
          randomSeed: 1,
        },
      },
      {
        column: 'emailIds_tokens',
        name: 'email_tokens_idx',
        type: 'tokenbf_v1',
        options: {
          granularity: 4,
          ngramSize: 3,
          bloomFilterSize: 512,
          numHashFunctions: 5,
          randomSeed: 1,
        },
      },
      {
        column: 'drsScore_drsScore, craRiskLevel',
        name: 'risk_score_idx',
        type: 'minmax',
        options: { granularity: 4 },
      },
    ],
    materializedViews: [
      {
        viewName: CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.viewName,
        columns: ['id String', 'data String', userNameMaterilizedColumn],
        table: CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.table,
        engine: 'ReplacingMergeTree',
        primaryKey: 'id',
        orderBy: 'id',
      },
    ],
    mongoIdColumn: true,
    optimize: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName,
    idColumn: 'eventId',
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(transactionId, timestamp, id)',
    orderBy: '(transactionId, timestamp, id)',
    mongoIdColumn: true,
    materializedColumns: [
      "transactionId String MATERIALIZED JSON_VALUE(data, '$.transactionId')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.USER_EVENTS.tableName,
    idColumn: 'eventId',
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(userId, timestamp, id)',
    orderBy: '(userId, timestamp, id)',
    mongoIdColumn: true,
    materializedColumns: [
      "userId String MATERIALIZED JSON_VALUE(data, '$.userId')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.CASES.tableName,
    idColumn: 'caseId',
    timestampColumn: 'createdTimestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    mongoIdColumn: true,
    materializedColumns: [
      "originUserId String MATERIALIZED JSONExtractString(data, 'caseUsers', 'origin', 'userId')",
      "destinationUserId String MATERIALIZED JSONExtractString(data, 'caseUsers', 'destination', 'userId')",
      "caseId String MATERIALIZED JSONExtractString(data, 'caseId')",
      "caseStatus LowCardinality(String) MATERIALIZED JSONExtractString(data, 'caseStatus')",
      "statusChanges Array(Tuple(timestamp UInt64, caseStatus String, userId String)) MATERIALIZED JSONExtract(data, 'statusChanges', 'Array(Tuple(timestamp UInt64, caseStatus String, userId String))')",
      "assignments Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'assignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",
      "reviewAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'reviewAssignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",
      "lastStatusChangeReasons Array(String) MATERIALIZED JSONExtractArrayRaw(data, 'lastStatusChange', 'reason')",
      `alerts Array(Tuple(
        alertId String, 
        alertStatus String, 
        statusChanges String, 
        assignments String, 
        reviewAssignments String,
        ruleId String,
        ruleInstanceId String,
        numberOfTransactionsHit Int32,
        createdTimestamp UInt64,
        priority String,
        lastStatusChangeReasons Array(String)
      )) MATERIALIZED
        arrayMap(x -> CAST((
          JSONExtractString(x, 'alertId'),
          JSONExtractString(x, 'alertStatus'),
          JSONExtractString(x, 'statusChanges'),
          JSONExtractString(x, 'assignments'),
          JSONExtractString(x, 'reviewAssignments'),
          JSONExtractString(x, 'ruleId'),
          JSONExtractString(x, 'ruleInstanceId'),
          JSONExtractInt(x, 'numberOfTransactionsHit'),
          JSONExtractUInt(x, 'createdTimestamp'),
          JSONExtractString(x, 'priority'),
          JSONExtractArrayRaw(x, 'lastStatusChange', 'reason')
        ), 'Tuple(alertId String, alertStatus String, statusChanges String, assignments String, reviewAssignments String, ruleId String, ruleInstanceId String, numberOfTransactionsHit Int32, createdTimestamp UInt64, priority String, lastStatusChangeReasons Array(String))'),
        JSONExtractArrayRaw(data, 'alerts'))`,
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.KRS_SCORE.tableName,
    idColumn: 'userId',
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(id, timestamp)',
    orderBy: '(id, timestamp)',
    mongoIdColumn: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.DRS_SCORE.tableName,
    idColumn: 'userId',
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(id, timestamp)',
    orderBy: '(id, timestamp)',
    mongoIdColumn: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.ARS_SCORE.tableName,
    idColumn: 'transactionId',
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(id, originUserId, destinationUserId, timestamp)',
    orderBy: '(id, originUserId, destinationUserId, timestamp)',
    mongoIdColumn: true,
    materializedColumns: [
      "originUserId String MATERIALIZED JSON_VALUE(data, '$.originUserId')",
      "destinationUserId String MATERIALIZED JSON_VALUE(data, '$.destinationUserId')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.tableName,
    idColumn: 'searchId',
    timestampColumn: 'lastScreenedAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, name, entity)',
    orderBy: '(timestamp, name, entity)',
    mongoIdColumn: true,
    materializedColumns: [
      "name String MATERIALIZED JSON_VALUE(data, '$.name')",
      enumFields(SANCTIONS_SCREENING_ENTITYS, 'entity', 'entity'),
      "isNew Bool MATERIALIZED JSONExtractBool(data, 'isNew')",
      "ruleInstanceIds Array(String) MATERIALIZED JSONExtract(data, 'ruleInstanceIds', 'Array(String)')",
      "userIds Array(String) MATERIALIZED JSONExtract(data, 'userIds', 'Array(String)')",
      "transactionIds Array(String) MATERIALIZED JSONExtract(data, 'transactionIds', 'Array(String)')",
      "isOngoingScreening Bool MATERIALIZED JSONExtractBool(data, 'isOngoingScreening')",
      "isHit Bool MATERIALIZED JSONExtractBool(data, 'isHit')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.ALERTS.tableName,
    idColumn: 'alertId',
    timestampColumn: 'createdTimestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(caseId, id)',
    orderBy: '(caseId, id)',
    materializedColumns: [
      "caseId String MATERIALIZED JSON_VALUE(data, '$.caseId')",
      "caseStatus String MATERIALIZED JSON_VALUE(data, '$.caseStatus')",
      "alertStatus String MATERIALIZED JSON_VALUE(data, '$.alertStatus')",
      "updatedAt UInt64 MATERIALIZED toUInt64OrNull(JSON_VALUE(data, '$.updatedAt'))",
      "assignments Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'assignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",
      "reviewAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'reviewAssignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.NANGO_RECORDS.tableName,
    idColumn: 'id',
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(modelName, id)',
    orderBy: '(modelName, id)',
    materializedColumns: [
      "model String MATERIALIZED JSON_VALUE(data, '$.model')",
    ],
  },
] as const

export type TableName = (typeof ClickHouseTables)[number]['table']

export const MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE = {
  [MONGO_TABLE_SUFFIX_MAP.TRANSACTIONS]:
    CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
  [MONGO_TABLE_SUFFIX_MAP.USERS]: CLICKHOUSE_DEFINITIONS.USERS.tableName,
  [MONGO_TABLE_SUFFIX_MAP.TRANSACTION_EVENTS]:
    CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName,
  [MONGO_TABLE_SUFFIX_MAP.USER_EVENTS]:
    CLICKHOUSE_DEFINITIONS.USER_EVENTS.tableName,
  [MONGO_TABLE_SUFFIX_MAP.CASES]: CLICKHOUSE_DEFINITIONS.CASES.tableName,
  [MONGO_TABLE_SUFFIX_MAP.KRS_SCORE]:
    CLICKHOUSE_DEFINITIONS.KRS_SCORE.tableName,
  [MONGO_TABLE_SUFFIX_MAP.DRS_SCORE]:
    CLICKHOUSE_DEFINITIONS.DRS_SCORE.tableName,
  [MONGO_TABLE_SUFFIX_MAP.ARS_SCORE]:
    CLICKHOUSE_DEFINITIONS.ARS_SCORE.tableName,
  [MONGO_TABLE_SUFFIX_MAP.SANCTIONS_SCREENING_DETAILS]:
    CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.tableName,
}

export const CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO = memoize(() =>
  invert(MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE)
)
