import { invert, memoize, uniq } from 'lodash'
import { MONGO_TABLE_SUFFIX_MAP } from '../mongodb-definitions'
import {
  userStatsColumns,
  userStatsMVQuery,
} from './queries/user-stats-clickhouse'
import {
  transactionStatsColumns,
  getTransactionStatsClickhouseMVQuery,
} from './queries/transaction-stats-clickhouse'
import { ruleStatsTransactionsMVQuery } from './queries/rule-stats-clickhouse'
import {
  investigationTimesStatsColumns,
  getCreateInvestigationTimesStatsClickhouseMVQuery,
} from './queries/investgation-times-stats-clickhouse'
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
  engine: 'ReplacingMergeTree' | 'AggregatingMergeTree' | 'SummingMergeTree'
  primaryKey: string
  orderBy: string
  partitionBy?: string
  mongoIdColumn?: boolean
  optimize?: boolean
}

type QueryCallback = (tenantId: string) => Promise<string>

export type MaterializedViewDefinition = Omit<
  BaseTableDefinition,
  'idColumn' | 'timestampColumn' | 'projections' | 'materializedColumns'
> & {
  viewName: string
  columns: string[]
  query?: string | QueryCallback
  refresh?: {
    interval: number
    granularity: 'MINUTE' | 'HOUR' | 'DAY' | 'SECOND'
  }
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

export enum ClickhouseTableNames {
  Transactions = 'transactions',
  Users = 'users',
  TransactionEvents = 'transaction_events',
  UserEvents = 'user_events',
  Cases = 'cases',
  Reports = 'reports',
  KrsScore = 'krs_score',
  DrsScore = 'drs_score',
  ArsScore = 'ars_score',
  SanctionsScreeningDetails = 'sanctions_screening_details',
  Alerts = 'alerts',
  CrmRecords = 'crm_records',
  CrmUserRecordLink = 'crm_user_record_link',
  DynamicPermissionsItems = 'dynamic_permissions_items',
}

export const CLICKHOUSE_DEFINITIONS = {
  TRANSACTIONS: {
    tableName: ClickhouseTableNames.Transactions,
    definition: {
      idColumn: 'transactionId',
      timestampColumn: 'timestamp',
    },
    materializedViews: {
      BY_ID: {
        viewName: 'transactions_by_id_mv',
        table: 'transactions_by_id',
      },
      TRANSACTION_MONTHLY_STATS: {
        viewName: 'transactions_monthly_stats_mv',
        table: 'transactions_monthly_stats',
      },
      TRANSACTION_HOURLY_STATS: {
        viewName: 'transactions_hourly_stats_mv',
        table: 'transactions_hourly_stats',
      },
      TRANSACTION_DAILY_STATS: {
        viewName: 'transactions_daily_stats_mv',
        table: 'transactions_daily_stats',
      },
      RULE_STATS_HOURLY: {
        viewName: 'rule_stats_hourly_transactions_mv',
        table: 'rule_stats_hourly_transactions',
      },
    },
  },
  USERS: {
    tableName: ClickhouseTableNames.Users,
    definition: {
      idColumn: 'userId',
      timestampColumn: 'createdTimestamp',
    },
    materializedViews: {
      BY_ID: {
        viewName: 'users_by_id_mv',
        table: 'users_by_id',
      },
      USER_MONTHLY_STATS: {
        viewName: 'user_monthly_stats_mv',
        table: 'user_monthly_stats',
      },
      USER_HOURLY_STATS: {
        viewName: 'user_hourly_stats_mv',
        table: 'user_hourly_stats',
      },
      USER_DAILY_STATS: {
        viewName: 'user_daily_stats_mv',
        table: 'user_daily_stats',
      },
    },
  },
  TRANSACTION_EVENTS: {
    tableName: ClickhouseTableNames.TransactionEvents,
  },
  USER_EVENTS: {
    tableName: ClickhouseTableNames.UserEvents,
  },
  CASES: {
    tableName: ClickhouseTableNames.Cases,
    materializedViews: {
      INVESTIGATION_TIMES_HOURLY_STATS: {
        viewName: 'cases_investigation_times_hourly_mv',
        table: 'cases_investigation_times_hourly',
      },
    },
  },
  REPORTS: {
    tableName: ClickhouseTableNames.Reports,
  },
  KRS_SCORE: {
    tableName: ClickhouseTableNames.KrsScore,
  },
  DRS_SCORE: {
    tableName: ClickhouseTableNames.DrsScore,
  },
  ARS_SCORE: {
    tableName: ClickhouseTableNames.ArsScore,
  },
  SANCTIONS_SCREENING_DETAILS: {
    tableName: ClickhouseTableNames.SanctionsScreeningDetails,
    materializedViews: {
      BY_ID: {
        viewName: 'sanctions_screening_details_by_id_mv',
        table: 'sanctions_screening_details_by_id',
      },
    },
  },
  ALERTS: {
    tableName: ClickhouseTableNames.Alerts,
  },
  CRM_RECORDS: {
    tableName: ClickhouseTableNames.CrmRecords,
  },
  CRM_USER_RECORD_LINK: {
    tableName: ClickhouseTableNames.CrmUserRecordLink,
  },
  DYNAMIC_PERMISSIONS_ITEMS: {
    tableName: ClickhouseTableNames.DynamicPermissionsItems,
  },
} as const

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
      `nonShadowHitRules Array(String) MATERIALIZED arrayMap(
        x -> JSONExtractString(x, 'ruleInstanceId'),
        arrayFilter(
          x -> JSONExtractBool(x, 'isShadow') != true,
          JSONExtractArrayRaw(data, 'hitRules')
        )
      )`,
      `nonShadowHitRuleIdPairs Array(Tuple(ruleInstanceId String, ruleId String)) MATERIALIZED 
        arrayMap(x -> (
          JSONExtractString(x, 'ruleInstanceId'),
          JSONExtractString(x, 'ruleId')
        ),
        arrayFilter(
          x -> JSONExtractBool(x, 'isShadow') != true,
          JSONExtractArrayRaw(data, 'hitRules')
        )
      )`,
      `nonShadowExecutedRules Array(String) MATERIALIZED arrayMap(
        x -> JSONExtractString(x, 'ruleInstanceId'),
        arrayFilter(
          x -> JSONExtractBool(x, 'isShadow') != true,
          JSONExtractArrayRaw(data, 'executedRules')
        )
      )`,
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
      `hitRulesWithMeta Array(
        Tuple(
          ruleInstanceId String,
          hitDirections Array(String),
          isShadow UInt8
        )
      ) MATERIALIZED 
        arrayMap(x -> 
          tuple(
            JSONExtractString(x, 'ruleInstanceId'),
            JSONExtractArrayRaw(JSONExtractRaw(x, 'ruleHitMeta'), 'hitDirections'),
            JSONExtractBool(x, 'isShadow')
          ),
          JSONExtractArrayRaw(data, 'hitRules')
        )`,

      `originShadowHitRuleIds Array(String) MATERIALIZED
        arrayMap(x -> x.1, 
          arrayFilter(x -> 
            hasAny(x.2, ['"ORIGIN"']) AND x.3 = 1, 
            hitRulesWithMeta
          )
        )`,

      `originNonShadowHitRuleIds Array(String) MATERIALIZED
        arrayMap(x -> x.1,
          arrayFilter(x -> 
            hasAny(x.2, ['"ORIGIN"']) AND x.3 = 0, 
            hitRulesWithMeta
          )
        )`,

      `destinationShadowHitRuleIds Array(String) MATERIALIZED
        arrayMap(x -> x.1, 
          arrayFilter(x -> 
            hasAny(x.2, ['"DESTINATION"']) AND x.3 = 1, 
            hitRulesWithMeta
          )
        )`,

      `destinationNonShadowHitRuleIds Array(String) MATERIALIZED
        arrayMap(x -> x.1,
          arrayFilter(x -> 
            hasAny(x.2, ['"DESTINATION"']) AND x.3 = 0, 
            hitRulesWithMeta
          )
        )`,
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
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews
            .TRANSACTION_MONTHLY_STATS.viewName,
        columns: transactionStatsColumns.map((c) => `${c.name} ${c.type}`),
        engine: 'SummingMergeTree',
        primaryKey: 'time',
        orderBy: 'time',
        table:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews
            .TRANSACTION_MONTHLY_STATS.table,
        query: getTransactionStatsClickhouseMVQuery(
          'toStartOfMonth(toDateTime(timestamp / 1000))'
        ),
      },
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews
            .TRANSACTION_DAILY_STATS.viewName,
        columns: transactionStatsColumns.map((c) => `${c.name} ${c.type}`),
        engine: 'SummingMergeTree',
        primaryKey: 'time',
        orderBy: 'time',
        table:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews
            .TRANSACTION_DAILY_STATS.table,
        query: getTransactionStatsClickhouseMVQuery(
          'toDate(toDateTime(timestamp / 1000))'
        ),
      },
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews
            .TRANSACTION_HOURLY_STATS.viewName,
        columns: transactionStatsColumns.map((c) => `${c.name} ${c.type}`),
        engine: 'SummingMergeTree',
        primaryKey: 'time',
        orderBy: 'time',
        table:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews
            .TRANSACTION_HOURLY_STATS.table,
        query: getTransactionStatsClickhouseMVQuery(
          'toStartOfHour(toDateTime(timestamp / 1000))'
        ),
      },
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews
            .RULE_STATS_HOURLY.viewName,
        columns: ['time DateTime', 'ruleId String', 'ruleInstanceId String'],
        engine: 'SummingMergeTree',
        primaryKey: 'time',
        orderBy: '(time, ruleId, ruleInstanceId)',
        table:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews
            .RULE_STATS_HOURLY.table,
        query: ruleStatsTransactionsMVQuery(
          'toStartOfHour(toDateTime(timestamp / 1000))'
        ),
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
      `nationality String MATERIALIZED JSONExtractString(data, 'userDetails', 'countryOfNationality')`,
      `residence String MATERIALIZED JSONExtractString(data, 'userDetails', 'countryOfResidence')`,
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
      `executedRules Array(Tuple(ruleInstanceId String, executedAt UInt64, isShadow Bool)) MATERIALIZED 
        JSONExtract(JSONExtractRaw(data, 'executedRules'), 'Array(Tuple(ruleInstanceId String, executedAt UInt64, isShadow Bool))')`,
      `hitRules Array(Tuple(ruleInstanceId String, executedAt UInt64, isShadow Bool)) MATERIALIZED 
        JSONExtract(JSONExtractRaw(data, 'hitRules'), 'Array(Tuple(ruleInstanceId String, executedAt UInt64, isShadow Bool))')`,
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
        columns: [
          'id String',
          'data String',
          userNameMaterilizedColumn,
          enumFields(USER_TYPES, 'type', 'type'),
        ],
        table: CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.table,
        engine: 'ReplacingMergeTree',
        primaryKey: 'id',
        orderBy: 'id',
      },
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.USERS.materializedViews.USER_MONTHLY_STATS
            .viewName,
        columns: userStatsColumns.map((c) => `${c.name} ${c.type}`),
        table:
          CLICKHOUSE_DEFINITIONS.USERS.materializedViews.USER_MONTHLY_STATS
            .table,
        engine: 'SummingMergeTree',
        primaryKey: 'time',
        orderBy: 'time',
        query: (tenantId) =>
          userStatsMVQuery(
            'toStartOfMonth(toDateTime(timestamp / 1000))',
            tenantId
          ),
      },
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.USERS.materializedViews.USER_DAILY_STATS
            .viewName,
        columns: userStatsColumns.map((c) => `${c.name} ${c.type}`),
        table:
          CLICKHOUSE_DEFINITIONS.USERS.materializedViews.USER_DAILY_STATS.table,
        engine: 'SummingMergeTree',
        primaryKey: 'time',
        orderBy: 'time',
        query: (tenantId) =>
          userStatsMVQuery('toDate(toDateTime(timestamp / 1000))', tenantId),
      },
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.USERS.materializedViews.USER_HOURLY_STATS
            .viewName,
        columns: userStatsColumns.map((c) => `${c.name} ${c.type}`),

        table:
          CLICKHOUSE_DEFINITIONS.USERS.materializedViews.USER_HOURLY_STATS
            .table,
        engine: 'SummingMergeTree',
        primaryKey: 'time',
        orderBy: 'time',
        query: (tenantId) =>
          userStatsMVQuery(
            'toStartOfHour(toDateTime(timestamp / 1000))',
            tenantId
          ),
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
        statusChanges Array(Tuple(timestamp UInt64, caseStatus String, userId String)), 
        assignments Array(Tuple(assigneeUserId String, timestamp UInt64)), 
        reviewAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)),
        ruleId String,
        ruleInstanceId String,
        numberOfTransactionsHit Int32,
        createdTimestamp UInt64,
        priority String,
        lastStatusChangeReasons Array(String),
        lastStatusChangeTimestamp UInt64,
        slaPolicyDetails Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64)),
        updatedAt UInt64,
        ruleQaStatus String,
        ruleChecklistTemplateId String,
        ruleChecklistItemId Array(String),
        qaAssignments Array(Tuple(assigneeUserId String, timestamp UInt64))
      )) MATERIALIZED
        arrayMap(x -> CAST((
          JSONExtractString(x, 'alertId'),
          JSONExtractString(x, 'alertStatus'),
          JSONExtract(x, 'statusChanges', 'Array(Tuple(timestamp UInt64, caseStatus String, userId String))'),
          JSONExtract(x, 'assignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))'),
          JSONExtract(x, 'reviewAssignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))'),
          JSONExtractString(x, 'ruleId'),
          JSONExtractString(x, 'ruleInstanceId'),
          JSONExtractInt(x, 'numberOfTransactionsHit'),
          JSONExtractUInt(x, 'createdTimestamp'),
          JSONExtractString(x, 'priority'),
          JSONExtractArrayRaw(x, 'lastStatusChange', 'reason'),
          JSONExtractUInt(x, 'lastStatusChange', 'timestamp'),
          JSONExtract(x, 'slaPolicyDetails', 'Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64))'),
          JSONExtractUInt(x, 'updatedAt'),
          JSONExtractString(x, 'ruleQaStatus'),
          JSONExtractString(x, 'ruleChecklistTemplateId'),
          JSONExtractArrayRaw(x, 'ruleChecklist', 'checklistItemId'),
          JSONExtract(x, 'qaAssignment', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')
        ), 'Tuple(alertId String, alertStatus String, statusChanges Array(Tuple(timestamp UInt64, caseStatus String, userId String)), assignments Array(Tuple(assigneeUserId String, timestamp UInt64)), reviewAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)), ruleId String, ruleInstanceId String, numberOfTransactionsHit Int32, createdTimestamp UInt64, priority String, lastStatusChangeReasons Array(String), lastStatusChangeTimestamp UInt64, slaPolicyDetails Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64)), updatedAt UInt64, ruleQaStatus String, ruleChecklistTemplateId String, ruleChecklistItemId Array(String), qaAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)))'),
        JSONExtractArrayRaw(data, 'alerts'))`,
    ],
    materializedViews: [
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.CASES.materializedViews
            .INVESTIGATION_TIMES_HOURLY_STATS.viewName,
        columns: investigationTimesStatsColumns.map(
          (c) => `${c.name} ${c.type}`
        ),
        engine: 'ReplacingMergeTree',
        primaryKey: 'time',
        orderBy: 'time',
        table:
          CLICKHOUSE_DEFINITIONS.CASES.materializedViews
            .INVESTIGATION_TIMES_HOURLY_STATS.table,
        query: getCreateInvestigationTimesStatsClickhouseMVQuery,
      },
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
    materializedViews: [
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.materializedViews
            .BY_ID.viewName,
        columns: ['id String', 'data String'],
        table:
          CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.materializedViews
            .BY_ID.table,
        engine: 'ReplacingMergeTree',
        primaryKey: 'id',
        orderBy: 'id',
      },
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.REPORTS.tableName,
    idColumn: '_id',
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    mongoIdColumn: true,
    materializedColumns: [
      "status String MATERIALIZED JSONExtractString(data, 'status')",
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
    table: CLICKHOUSE_DEFINITIONS.CRM_RECORDS.tableName,
    idColumn: 'id',
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(recordType, crmName, id)',
    orderBy: '(recordType, crmName, id)',
    materializedColumns: [
      "recordType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'recordType')",
      "crmName LowCardinality(String) MATERIALIZED JSONExtractString(data, 'crmName')",
      "ticketSubject String MATERIALIZED JSONExtractString(data, 'data', 'record', 'subject')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.CRM_USER_RECORD_LINK.tableName,
    idColumn: 'id',
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(userId, crmName, recordType, id)',
    orderBy: '(userId, crmName, recordType, id)',
    materializedColumns: [
      "recordType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'recordType')",
      "crmName LowCardinality(String) MATERIALIZED JSONExtractString(data, 'crmName')",
      "userId String MATERIALIZED JSONExtractString(data, 'userId')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.DYNAMIC_PERMISSIONS_ITEMS.tableName,
    idColumn: 'id',
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(subType, id)',
    orderBy: '(subType, id)',
    materializedColumns: [
      "subType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'subType')",
      "name String MATERIALIZED JSONExtractString(data, 'name')",
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
  [MONGO_TABLE_SUFFIX_MAP.REPORTS]: CLICKHOUSE_DEFINITIONS.REPORTS.tableName,
}

export const CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO = memoize(() =>
  invert(MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE)
)
