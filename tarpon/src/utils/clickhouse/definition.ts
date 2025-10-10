import uniq from 'lodash/uniq'
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
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'
import { USER_TYPES } from '@/@types/user/user-type'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'
import { SANCTIONS_SCREENING_ENTITYS } from '@/@types/openapi-internal-custom/SanctionsScreeningEntity'
import { ClickhouseTableDefinition } from '@/@types/clickhouse'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { CLICKHOUSE_ID_COLUMN_MAP } from '@/constants/clickhouse/id-column-map'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'

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

export const userNameMaterilizedColumn = `username String MATERIALIZED 
        IF(
        JSON_VALUE(data, '$.type') = 'CONSUMER', 
        COALESCE(
            trim(BOTH ' ' FROM 
                replaceRegexpAll(
                    CONCAT(
                        COALESCE(JSON_VALUE(data, '$.userDetails.name.firstName'), ''),
                        ' ',
                        COALESCE(JSON_VALUE(data, '$.userDetails.name.middleName'), ''),
                        ' ',
                        COALESCE(JSON_VALUE(data, '$.userDetails.name.lastName'), '')
                    ),
                    '\\\\s+', ' '
                )
            ),
            ''
        ),
        JSON_VALUE(data, '$.legalEntity.companyGeneralDetails.legalName')
    )`

export const userNameCasesV2MaterializedColumn = `
  userName String MATERIALIZED coalesce(
    nullIf(trim(BOTH ' ' FROM 
      replaceRegexpAll(
        concat(
          COALESCE(JSONExtractString(JSONExtractRaw(JSONExtractRaw(data, 'caseUsers'), 'origin', 'userDetails', 'name'), 'firstName'), ''),
          ' ',
          COALESCE(JSONExtractString(JSONExtractRaw(JSONExtractRaw(data, 'caseUsers'), 'origin', 'userDetails', 'name'), 'middleName'), ''),
          ' ',
          COALESCE(JSONExtractString(JSONExtractRaw(JSONExtractRaw(data, 'caseUsers'), 'origin', 'userDetails', 'name'), 'lastName'), '')
        ),
        '\\\\s+', ' '
      )
    ), ''),
    
    nullIf(trim(BOTH ' ' FROM 
      replaceRegexpAll(
        concat(
          COALESCE(JSONExtractString(JSONExtractRaw(JSONExtractRaw(data, 'caseUsers'), 'destination', 'userDetails', 'name'), 'firstName'), ''),
          ' ',
          COALESCE(JSONExtractString(JSONExtractRaw(JSONExtractRaw(data, 'caseUsers'), 'destination', 'userDetails', 'name'), 'middleName'), ''),
          ' ',
          COALESCE(JSONExtractString(JSONExtractRaw(JSONExtractRaw(data, 'caseUsers'), 'destination', 'userDetails', 'name'), 'lastName'), '')
        ),
        '\\\\s+', ' '
      )
    ), ''),
    
    nullIf(JSONExtractString(JSONExtractRaw(JSONExtractRaw(data, 'caseUsers'), 'destination', 'legalEntity', 'companyGeneralDetails'), 'legalName'), ''),
    nullIf(JSONExtractString(JSONExtractRaw(JSONExtractRaw(data, 'caseUsers'), 'origin', 'legalEntity', 'companyGeneralDetails'), 'legalName'), ''),
    ''
  )
`

export const generatePaymentDetailsName = (prefix: string) => {
  return [
    `${prefix}PaymentDetailsName String MATERIALIZED 
    CASE
      WHEN JSONExtractString(data, '${prefix}PaymentDetails', 'method') = 'CARD' THEN
        trimBoth(
          replaceRegexpAll(
            concat_ws(' ',
              JSONExtractString(data, '${prefix}PaymentDetails', 'nameOnCard', 'firstName'),
              JSONExtractString(data, '${prefix}PaymentDetails', 'nameOnCard', 'middleName'),
              JSONExtractString(data, '${prefix}PaymentDetails', 'nameOnCard', 'lastName')
            ),
            '\\s+', ' '
          )
        )
      WHEN JSONExtractString(data, '${prefix}PaymentDetails', 'method') = 'NPP' THEN
        trimBoth(
          replaceRegexpAll(
            concat_ws(' ',
              JSONExtractString(data, '${prefix}PaymentDetails', 'name', 'firstName'),
              JSONExtractString(data, '${prefix}PaymentDetails', 'name', 'middleName'),
              JSONExtractString(data, '${prefix}PaymentDetails', 'name', 'lastName')
            ),
            '\\s+', ' '
          )
        )
      ELSE
        COALESCE(JSONExtractString(data, '${prefix}PaymentDetails', 'name'), '')
    END`,
  ]
}

const sharedTransactionMaterializedColumns = [
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
  "type String MATERIALIZED JSON_VALUE(data, '$.type')",
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
  `nonShadowExecutedRuleIdPairs Array(Tuple(ruleInstanceId String, ruleId String)) MATERIALIZED 
    arrayMap(x -> (
      JSONExtractString(x, 'ruleInstanceId'),
      JSONExtractString(x, 'ruleId')
    ),
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
  ...generatePaymentDetailsName('origin'),
  ...generatePaymentDetailsName('destination'),
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
  "ruleAction Array(String) MATERIALIZED arrayMap(x -> JSONExtractString(x, 'ruleAction'), JSONExtractArrayRaw(data, 'hitRules'))",
  `derived_status String
    MATERIALIZED
      CASE
        WHEN
          length(ruleAction) > 0 AND
          has(ruleAction, 'SUSPEND') AND
          NOT has(ruleAction, 'BLOCK') AND
          status IN ('ALLOW', 'BLOCK')
        THEN concat(status, '_MANUAL')
        ELSE status
      END`,
  `updateCount UInt64 MATERIALIZED JSONExtractUInt(data, 'updateCount')`,
  `createdAt UInt64 MATERIALIZED JSONExtractUInt(data, 'createdAt')`,
  `updatedAt UInt64 MATERIALIZED JSONExtractUInt(data, 'updatedAt')`,
  `paymentApprovalTimestamp UInt64 MATERIALIZED JSONExtractUInt(data, 'paymentApprovalTimestamp')`,
]

const businessIndustryMaterializedColumn = (
  type: 'origin' | 'destination'
) => `${type}BusinessIndustry Array(String) MATERIALIZED arrayMap(x -> replace(x, '"', ''), 
          JSONExtractArrayRaw(
            JSONExtractRaw(
              JSONExtractRaw(
                JSONExtractRaw(data, 'caseUsers'),
                '${type}'
              ),
              'employmentDetails'
            ),
            'businessIndustry'
          )
        )`

const commonMaterializedColumns = [
  "originUserId String MATERIALIZED JSONExtractString(data, 'caseUsers', 'origin', 'userId')",
  "destinationUserId String MATERIALIZED JSONExtractString(data, 'caseUsers', 'destination', 'userId')",
  "caseId String MATERIALIZED JSONExtractString(data, 'caseId')",
  "caseStatus LowCardinality(String) MATERIALIZED JSONExtractString(data, 'caseStatus')",
  "statusChanges Array(Tuple(timestamp UInt64, caseStatus String, userId String)) MATERIALIZED JSONExtract(data, 'statusChanges', 'Array(Tuple(timestamp UInt64, caseStatus String, userId String))')",
  "assignments Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'assignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",
  "reviewAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'reviewAssignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",
  "lastStatusChangeReasons Array(String) MATERIALIZED arrayMap(x -> replaceAll(x, '\"', ''), JSONExtractArrayRaw(data, 'lastStatusChange', 'reason'))",
  "lastStatusChangeUserId String MATERIALIZED JSONExtractString(data, 'lastStatusChange', 'userId')",
  "updatedAt UInt64 MATERIALIZED JSONExtractUInt(data, 'updatedAt')",
  "caseType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'caseType')",
  "priority LowCardinality(String) MATERIALIZED JSONExtractString(data, 'priority')",
  "caseTransactionsIds Array(String) MATERIALIZED arrayMap(x -> replaceAll(x, '\"', ''), JSONExtractArrayRaw(data, 'caseTransactionsIds'))",
  "availableAfterTimestamp UInt64 MATERIALIZED JSONExtractUInt(data, 'availableAfterTimestamp')",
  `destinationPaymentMethods Array(String) MATERIALIZED arrayMap(x -> replace(x, '"', ''), JSONExtractArrayRaw(data, 'caseAggregates', 'destinationPaymentMethods'))`,
  `originPaymentMethods Array(String) MATERIALIZED arrayMap(x -> replace(x, '"', ''), JSONExtractArrayRaw(data, 'caseAggregates', 'originPaymentMethods'))`,
  `tags Array(Tuple(key String, value String)) MATERIALIZED JSONExtract(JSONExtractRaw(data, 'caseAggregates', 'tags'), 'Array(Tuple(key String, value String))')`,
  "caseIdNumber UInt64 MATERIALIZED toUInt64OrZero(extract(id, '^C-(\\d+)$'))",
  "caseTransactionsCount UInt64 MATERIALIZED JSONExtractUInt(data, 'caseTransactionsCount')",
  businessIndustryMaterializedColumn('origin'),
  businessIndustryMaterializedColumn('destination'),
  "originUserDrsScore Float32 MATERIALIZED JSONExtractFloat(data, 'caseUsers', 'originUserDrsScore')",
  "destinationUserDrsScore Float32 MATERIALIZED JSONExtractFloat(data, 'caseUsers', 'destinationUserDrsScore')",
  "originUserState String MATERIALIZED JSONExtractString(data, 'caseUsers', 'origin', 'userStateDetails', 'state')",
  "destinationUserState String MATERIALIZED JSONExtractString(data, 'caseUsers', 'destination', 'userStateDetails', 'state')",
  "slaPolicyDetails Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64, timeToWarning UInt64, timeToBreach UInt64, updatedAt UInt64, startedAt UInt64, slaPolicyType String)) MATERIALIZED JSONExtract(data, 'slaPolicyDetails', 'Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64, timeToWarning UInt64, timeToBreach UInt64, updatedAt UInt64))')",
]

export const ClickHouseTables: ClickhouseTableDefinition[] = [
  // Example: Model-based table definition
  {
    table: CLICKHOUSE_DEFINITIONS.TRANSACTIONS_FROM_MODEL.tableName,
    idColumn:
      CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.TransactionsFromModel],
    timestampColumn:
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS_FROM_MODEL.definition.timestampColumn,
    materializedColumns: [`negative_timestamp Int64 MATERIALIZED -1*timestamp`],
    engine: 'ReplacingMergeTree',
    versionColumn: 'updateCount',
    primaryKey: '(negative_timestamp, originUserId, destinationUserId, id)',
    orderBy: '(negative_timestamp, originUserId, destinationUserId, id)',
    partitionBy: 'toYYYYMM(toDateTime(timestamp / 1000))',
    optimize: true,
    model: 'InternalTransaction',
  },
  {
    table: CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Transactions],
    timestampColumn:
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS.definition.timestampColumn,
    materializedColumns: [...sharedTransactionMaterializedColumns],
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
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_TYPE
            .viewName,
        columns: [
          'id String',
          'type String',
          'timestamp UInt64',
          'negative_timestamp Int64',
        ],
        engine: 'ReplacingMergeTree',
        primaryKey: '(type, negative_timestamp, id)',
        orderBy: '(type, negative_timestamp, id)',
        table:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_TYPE.table,
        query: `
          SELECT 
            id,
            type,
            timestamp,
            -1*timestamp as negative_timestamp
          FROM transactions
          WHERE timestamp != 0 AND updateCount = 1
        `,
      },
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_TYPE_DAILY
            .viewName,
        columns: [
          'day Date',
          'type String',
          'unique_transactions AggregateFunction(uniq, String)',
        ],
        engine: 'AggregatingMergeTree',
        primaryKey: '(day, type)',
        orderBy: '(day, type)',
        table:
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.materializedViews.BY_TYPE_DAILY
            .table,
        query: `
          SELECT 
            toDate(toDateTime(timestamp / 1000)) as day,
            type,
            uniqState(id) as unique_transactions
          FROM transactions
          WHERE timestamp != 0 AND updateCount = 1
          GROUP BY day, type
        `,
      },
    ],
    optimize: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.TRANSACTIONS_DESC.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.TransactionsDesc],
    timestampColumn:
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS_DESC.definition.timestampColumn,
    materializedColumns: [
      ...sharedTransactionMaterializedColumns,
      `negative_timestamp Int64 MATERIALIZED -1*timestamp`,
    ],
    engine: 'ReplacingMergeTree',
    versionColumn: 'updateCount',
    primaryKey: '(negative_timestamp, originUserId, destinationUserId, id)',
    orderBy: '(negative_timestamp, originUserId, destinationUserId, id)',
    partitionBy: 'toYYYYMM(toDateTime(timestamp / 1000))',
    mongoIdColumn: true,
    optimize: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.USERS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Users],
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
      `nonShadowExecutedRuleIdPairs Array(Tuple(ruleInstanceId String, ruleId String)) MATERIALIZED 
        arrayMap(x -> (
          JSONExtractString(x, 'ruleInstanceId'),
          JSONExtractString(x, 'ruleId')
        ),
        arrayFilter(
          x -> JSONExtractBool(x, 'isShadow') != true,
          JSONExtractArrayRaw(data, 'executedRules')
        )
      )`,
      `craRiskLevel Nullable(String) MATERIALIZED JSON_VALUE(data, '$.drsScore.manualRiskLevel')`,
      `drsScore_drsScore Float64 MATERIALIZED JSONExtractFloat(data, 'drsScore', 'drsScore')`,
      `krsScore_krsScore Float64 MATERIALIZED JSONExtractFloat(data, 'krsScore', 'krsScore')`,
      `updatedAt Nullable(UInt64) MATERIALIZED toUInt64OrNull(JSON_VALUE(data, '$.updatedAt'))`,
      `userStateDetails_state String MATERIALIZED JSONExtractString(data, 'userStateDetails', 'state')`,
      `userStateDetails_reason String MATERIALIZED JSONExtractString(data, 'userStateDetails', 'reason')`,
      `kycStatusDetails_status String MATERIALIZED JSONExtractString(data, 'kycStatusDetails', 'status')`,
      `executedRules Array(Tuple(ruleInstanceId String, executedAt UInt64, isShadow Bool)) MATERIALIZED 
        JSONExtract(JSONExtractRaw(data, 'executedRules'), 'Array(Tuple(ruleInstanceId String, executedAt UInt64, isShadow Bool))')`,
      `hitRules Array(Tuple(ruleInstanceId String, executedAt UInt64, isShadow Bool)) MATERIALIZED 
        JSONExtract(JSONExtractRaw(data, 'hitRules'), 'Array(Tuple(ruleInstanceId String, executedAt UInt64, isShadow Bool))')`,
      `linkedEntities_parentUserId String MATERIALIZED JSONExtractString(data, 'linkedEntities', 'parentUserId')`,
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
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.TransactionEvents],
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(transactionId, timestamp, id)',
    orderBy: '(transactionId, timestamp, id)',
    mongoIdColumn: true,
    materializedColumns: [
      "transactionId String MATERIALIZED JSON_VALUE(data, '$.transactionId')",
      "status String MATERIALIZED JSON_VALUE(data, '$.status')",
      `reasons Array(String) MATERIALIZED if(
        JSON_VALUE(data, '$.status') IN ('ALLOW', 'BLOCK'),
        splitByChar(',', JSON_VALUE(data, '$.reason')),
        []
      )`,
      `nonShadowExecutedRuleIdPairs Array(Tuple(ruleInstanceId String, ruleId String)) MATERIALIZED 
      arrayMap(x -> (
        JSONExtractString(x, 'ruleInstanceId'),
        JSONExtractString(x, 'ruleId')
      ),
      arrayFilter(
        x -> JSONExtractBool(x, 'isShadow') != true,
        JSONExtractArrayRaw(data, 'executedRules')
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
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.USER_EVENTS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.UserEvents],
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(userId, timestamp, id)',
    orderBy: '(userId, timestamp, id)',
    mongoIdColumn: true,
    materializedColumns: [
      "userId String MATERIALIZED JSON_VALUE(data, '$.userId')",
      `nonShadowExecutedRuleIdPairs Array(Tuple(ruleInstanceId String, ruleId String)) MATERIALIZED 
      arrayMap(x -> (
        JSONExtractString(x, 'ruleInstanceId'),
        JSONExtractString(x, 'ruleId')
      ),
      arrayFilter(
        x -> JSONExtractBool(x, 'isShadow') != true,
        JSONExtractArrayRaw(data, 'executedRules')
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
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.CASES.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Cases],
    timestampColumn: 'createdTimestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    mongoIdColumn: true,
    materializedColumns: [
      ...commonMaterializedColumns,
      userNameCasesV2MaterializedColumn,
      "alertsRuleInstanceIds Array(String) MATERIALIZED JSONExtractArrayRaw(data, 'alerts', 'Array(Tuple(ruleInstanceId String))')",
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
        slaPolicyDetails Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64, timeToWarning UInt64, timeToBreach UInt64, updatedAt UInt64)),
        updatedAt UInt64,
        ruleQaStatus String,
        ruleChecklistTemplateId String,
        ruleChecklistItemId Array(String),
        qaAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)),
        ruleNature String
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
          JSONExtract(x, 'slaPolicyDetails', 'Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64, timeToWarning UInt64, timeToBreach UInt64, updatedAt UInt64))'),
          JSONExtractUInt(x, 'updatedAt'),
          JSONExtractString(x, 'ruleQaStatus'),
          JSONExtractString(x, 'ruleChecklistTemplateId'),
          JSONExtractArrayRaw(x, 'ruleChecklist', 'checklistItemId'),
          JSONExtract(x, 'qaAssignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))'),
          JSONExtractString(x, 'ruleNature')
        ), 'Tuple(alertId String, alertStatus String, statusChanges Array(Tuple(timestamp UInt64, caseStatus String, userId String)), assignments Array(Tuple(assigneeUserId String, timestamp UInt64)), reviewAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)), ruleId String, ruleInstanceId String, numberOfTransactionsHit Int32, createdTimestamp UInt64, priority String, lastStatusChangeReasons Array(String), lastStatusChangeTimestamp UInt64, slaPolicyDetails Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64, timeToWarning UInt64, timeToBreach UInt64, updatedAt UInt64)), updatedAt UInt64, ruleQaStatus String, ruleChecklistTemplateId String, ruleChecklistItemId Array(String), qaAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)), ruleNature String)'),
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
    table: CLICKHOUSE_DEFINITIONS.CASES_V2.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.CasesV2],
    timestampColumn: 'createdTimestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(negativeTimestamp, id)',
    orderBy: '(negativeTimestamp, id)',
    mongoIdColumn: true,
    materializedColumns: [
      ...commonMaterializedColumns,
      userNameCasesV2MaterializedColumn,
      'negativeTimestamp Int64 MATERIALIZED -1*timestamp',
    ],
    partitionBy: 'toYYYYMM(toDateTime(timestamp / 1000))',
    versionColumn: 'updatedAt',
  },
  {
    table: CLICKHOUSE_DEFINITIONS.KRS_SCORE.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.KrsScore],
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(id, timestamp)',
    orderBy: '(id, timestamp)',
    mongoIdColumn: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.DRS_SCORE.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.DrsScore],
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(id, timestamp)',
    orderBy: '(id, timestamp)',
    mongoIdColumn: true,
  },
  {
    table: CLICKHOUSE_DEFINITIONS.ARS_SCORE.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.ArsScore],
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
    idColumn:
      CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.SanctionsScreeningDetails],
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
    table: CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS_V2.tableName,
    idColumn:
      CLICKHOUSE_ID_COLUMN_MAP[
        ClickhouseTableNames.SanctionsScreeningDetailsV2
      ],
    timestampColumn: 'lastScreenedAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, userId, transactionId, screeningId)',
    orderBy: '(timestamp, userId, transactionId, screeningId)',
    mongoIdColumn: false,
    materializedColumns: [
      "screeningId String MATERIALIZED JSON_VALUE(data, '$.screeningId')",
      "referenceCounter String MATERIALIZED JSON_VALUE(data, '$.referenceCounter')",
      "lastScreenedAt UInt64 MATERIALIZED JSON_VALUE(data, '$.lastScreenedAt')",
      "latestTimeStamp UInt64 MATERIALIZED JSON_VALUE(data, '$.latestTimeStamp')",
      "name String MATERIALIZED JSON_VALUE(data, '$.name')",
      enumFields(SANCTIONS_SCREENING_ENTITYS, 'entity', 'entity'),
      "isNew Bool MATERIALIZED JSONExtractBool(data, 'isNew')",
      "ruleInstanceIds Array(String) MATERIALIZED JSONExtract(data, 'ruleInstanceIds', 'Array(String)')",
      "userId String MATERIALIZED JSON_VALUE(data, '$.userId')",
      "transactionId String MATERIALIZED JSON_VALUE(data, '$.transactionId')",
      "isOngoingScreening Bool MATERIALIZED JSONExtractBool(data, 'isOngoingScreening')",
      "isHit Bool MATERIALIZED JSONExtractBool(data, 'isHit')",
    ],
    materializedViews: [
      {
        viewName:
          CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS_V2
            .materializedViews.BY_ID.viewName,
        columns: ['id String', 'data String'],
        table:
          CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS_V2
            .materializedViews.BY_ID.table,
        engine: 'ReplacingMergeTree',
        primaryKey: 'id',
        orderBy: 'id',
      },
    ],
  },

  {
    table: CLICKHOUSE_DEFINITIONS.REPORTS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Reports],
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
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Alerts],
    timestampColumn: 'createdTimestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(priority, negativeTimestamp, ruleInstanceId, caseId, id)',
    orderBy: '(priority, negativeTimestamp, ruleInstanceId, caseId, id)',
    materializedColumns: [
      "numberOfTransactionsHit Int32 MATERIALIZED JSONExtractInt(data, 'numberOfTransactionsHit')",
      "alertIdNumber UInt64 MATERIALIZED toUInt64OrZero(extract(id, '^A-(\\d+)$'))",
      "caseId String MATERIALIZED JSONExtractString(data, 'caseId')",
      "caseIdNumber UInt64 MATERIALIZED toUInt64OrZero(extract(JSONExtractString(data, 'caseId'), '^C-(\\d+)$'))",
      "caseStatus String MATERIALIZED JSONExtractString(data, 'caseStatus')",
      "alertStatus String MATERIALIZED JSONExtractString(data, 'alertStatus')",
      "updatedAt UInt64 MATERIALIZED JSONExtractUInt(data, 'updatedAt')",
      "ruleQaStatus String MATERIALIZED JSONExtractString(data, 'ruleQaStatus')",
      "caseCreatedTimestamp UInt64 MATERIALIZED COALESCE(toUInt64OrNull(JSON_VALUE(data, '$.caseCreatedTimestamp')), 0)",

      // Rule Metadata
      "ruleInstanceId String MATERIALIZED JSONExtractString(data, 'ruleInstanceId')",
      "ruleAction String MATERIALIZED JSONExtractString(data, 'ruleAction')",
      "ruleNature String MATERIALIZED JSONExtractString(data, 'ruleNature')",
      "ruleQueueId String MATERIALIZED JSONExtractString(data, 'ruleQueueId')",
      `ruleChecklistTemplateId String MATERIALIZED JSONExtractString(data, 'ruleChecklistTemplateId')`,
      // IDs and Statuses
      "priority String MATERIALIZED JSONExtractString(data, 'priority')",

      // Timestamps and Transaction Info
      "transactionIds Array(String) MATERIALIZED JSONExtract(data, 'transactionIds', 'Array(String)')",

      // Assignments -- done
      "assignments Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'assignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",
      "qaAssignment Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'qaAssignment', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",
      "reviewAssignments Array(Tuple(assigneeUserId String, timestamp UInt64)) MATERIALIZED JSONExtract(data, 'reviewAssignments', 'Array(Tuple(assigneeUserId String, timestamp UInt64))')",

      // SLA Policies
      `slaPolicyDetails Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64, timeToWarning UInt64, timeToBreach UInt64, updatedAt UInt64)) MATERIALIZED JSONExtract(data, 'slaPolicyDetails', 'Array(Tuple(slaPolicyId String, policyStatus String, elapsedTime UInt64, timeToWarning UInt64, timeToBreach UInt64, updatedAt UInt64))')`,

      "lastStatusChangeReasons Array(String) MATERIALIZED tupleElement(JSONExtract(data, 'lastStatusChange', 'Tuple(caseStatus String, timestamp UInt64, reason Array(String), userId String)'), 'reason')",
      "lastStatusChangeUserId String MATERIALIZED tupleElement(JSONExtract(data, 'lastStatusChange', 'Tuple(caseStatus String, timestamp UInt64, reason Array(String), userId String)'), 'userId')",
      "statusChanges Array(Tuple(timestamp UInt64, caseStatus String, userId String)) MATERIALIZED JSONExtract(data, 'statusChanges', 'Array(Tuple(timestamp UInt64, caseStatus String, userId String))')",
      'negativeTimestamp Int64 MATERIALIZED -1*timestamp',
      "createdAt UInt64 MATERIALIZED JSONExtractUInt(data, 'createdAt')",
    ],
    partitionBy: 'toYYYYMM(toDateTime(timestamp / 1000))',
    versionColumn: 'updatedAt',
  },
  {
    table: CLICKHOUSE_DEFINITIONS.CRM_RECORDS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.CrmRecords],
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
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.CrmUserRecordLink],
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
    idColumn:
      CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.DynamicPermissionsItems],
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(subType, id)',
    orderBy: '(subType, id)',
    materializedColumns: [
      "subType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'subType')",
      "name String MATERIALIZED JSONExtractString(data, 'name')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.AUDIT_LOGS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.AuditLogs],
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    materializedColumns: [
      "auditlogId String MATERIALIZED JSONExtractString(data, 'auditlogId')",
      "userRole LowCardinality(String) MATERIALIZED JSONExtractString(data, 'user', 'role')",
      "type LowCardinality(String) MATERIALIZED JSONExtractString(data, 'type')",
      "entityId String MATERIALIZED JSONExtractString(data, 'entityId')",
      "entityType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'entityType')",
      "subtype LowCardinality(String) MATERIALIZED JSONExtractString(data, 'subtype')",
      "newImageCaseStatus LowCardinality(String) MATERIALIZED JSONExtractString(data, 'newImage', 'caseStatus')",
      "newImageAlertStatus LowCardinality(String) MATERIALIZED JSONExtractString(data, 'newImage', 'alertStatus')",
      "userId String MATERIALIZED JSONExtractString(data, 'user', 'id')",
      "action LowCardinality(String) MATERIALIZED JSONExtractString(data, 'action')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.ALERTS_QA_SAMPLING.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.AlertsQaSampling],
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, samplingId)',
    orderBy: '(timestamp, samplingId)',
    materializedColumns: [
      "samplingId String MATERIALIZED JSONExtractString(data, 'samplingId')",
      "samplingType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'samplingType')",
      "samplingQuantity Int32 MATERIALIZED JSONExtractInt(data, 'samplingQuantity')",
      "samplingName String MATERIALIZED JSONExtractString(data, 'samplingName')",
      "samplingDescription String MATERIALIZED JSONExtractString(data, 'samplingDescription')",
      "priority String MATERIALIZED JSONExtractString(data, 'priority')",
      "createdBy String MATERIALIZED JSONExtractString(data, 'createdBy')",
      "alertIds Array(String) MATERIALIZED JSONExtract(data, 'alertIds', 'Array(String)')",
      "createdAt UInt64 MATERIALIZED JSONExtractUInt(data, 'createdAt')",
      "updatedAt UInt64 MATERIALIZED JSONExtractUInt(data, 'updatedAt')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.API_REQUEST_LOGS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.ApiRequestLogs],
    timestampColumn: 'timestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(timestamp, id)',
    orderBy: '(timestamp, id)',
    materializedColumns: [
      "requestId String MATERIALIZED JSONExtractString(data, 'requestId')",
      "path String MATERIALIZED JSONExtractString(data, 'path')",
      "method String MATERIALIZED JSONExtractString(data, 'method')",
      "userId String MATERIALIZED JSONExtractString(data, 'userId')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.NOTIFICATIONS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Notifications],
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: 'id',
    orderBy: 'id',
    materializedColumns: [
      "triggeredBy String MATERIALIZED JSONExtractString(data, 'triggeredBy')",
      "entityId String MATERIALIZED JSONExtractString(data, 'entityId')",
      "entityType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'entityType')",
      "notificationChannel LowCardinality(String) MATERIALIZED JSONExtractString(data, 'notificationChannel')",
      "notificationType LowCardinality(String) MATERIALIZED JSONExtractString(data, 'notificationType')",
      "recievers Array(String) MATERIALIZED JSONExtract(data, 'recievers', 'Array(String)')",
      "consoleNotificationStatuses Array(Tuple(status String, statusUpdatedAt UInt64, recieverUserId String)) MATERIALIZED JSONExtract(data, 'consoleNotificationStatuses', 'Array(Tuple(status String, statusUpdatedAt UInt64, recieverUserId String))')",
      "createdAt UInt64 MATERIALIZED JSONExtractUInt(data, 'createdAt')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.GPT_REQUESTS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.GptRequests],
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: 'id',
    orderBy: 'id',
    mongoIdColumn: true,
    materializedColumns: [],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.METRICS.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Metrics],
    timestampColumn: 'collectedTimestamp',
    engine: 'ReplacingMergeTree',
    primaryKey: '(date, name)',
    orderBy: '(date, name)',
    mongoIdColumn: true,
    materializedColumns: [
      "name LowCardinality(String) MATERIALIZED JSONExtractString(data, 'name')",
      "date Date MATERIALIZED JSONExtractString(data, 'date')",
      "value Float64 MATERIALIZED JSONExtractFloat(data, 'value')",
      "collectedTimestamp UInt64 MATERIALIZED JSONExtractUInt(data, 'collectedTimestamp')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.WEBHOOK.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Webhook],
    timestampColumn: 'createdAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(id)',
    orderBy: '(id)',
    materializedColumns: [
      "_id String MATERIALIZED JSONExtractString(data, '_id')",
      "createdAt UInt64 MATERIALIZED JSONExtractUInt(data, 'createdAt')",
      "webhookUrl String MATERIALIZED JSONExtractString(data, 'webhookUrl')",
      "enabled Bool MATERIALIZED JSONExtractBool(data, 'enabled')",
      "enabledAt UInt64 MATERIALIZED JSONExtractUInt(data, 'enabledAt')",
      "autoDisableMessage String MATERIALIZED JSONExtractString(data, 'autoDisableMessage')",
      "events Array(String) MATERIALIZED JSONExtract(data, 'events', 'Array(String)')",
    ],
  },
  {
    table: CLICKHOUSE_DEFINITIONS.WEBHOOK_DELIVERIES.tableName,
    idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.WebhookDelivery],
    timestampColumn: 'eventCreatedAt',
    engine: 'ReplacingMergeTree',
    primaryKey: '(id)',
    orderBy: '(id)',
    materializedColumns: [
      "_id String MATERIALIZED JSONExtractString(data, '_id')",
      "deliveryTaskId String MATERIALIZED JSONExtractString(data, 'deliveryTaskId')",
      "webhookId String MATERIALIZED JSONExtractString(data, 'webhookId')",
      "webhookUrl String MATERIALIZED JSONExtractString(data, 'webhookUrl')",
      "requestStartedAt UInt64 MATERIALIZED JSONExtractUInt(data, 'requestStartedAt')",
      "requestFinishedAt UInt64 MATERIALIZED JSONExtractUInt(data, 'requestFinishedAt')",
      "success Bool MATERIALIZED JSONExtractBool(data, 'success')",
      "event String MATERIALIZED JSONExtractString(data, 'event')",
      "eventCreatedAt UInt64 MATERIALIZED JSONExtractUInt(data, 'eventCreatedAt')",
      "entityId String MATERIALIZED JSONExtractString(data, 'entityId')",
      "manualRetry Bool MATERIALIZED JSONExtractBool(data, 'manualRetry')",
      "deliveredAt UInt64 MATERIALIZED JSONExtractUInt(data, 'deliveredAt')",
    ],
  },
] as const

export type TableName = (typeof ClickHouseTables)[number]['table']
