import { Credentials } from 'aws-lambda'
import { Filter } from 'mongodb'
import { SimulationRiskLevelsParameters } from '../openapi-internal/SimulationRiskLevelsParameters'
import { SimulationBeaconParameters } from '../openapi-internal/SimulationBeaconParameters'
import { RuleInstance } from '../openapi-internal/RuleInstance'
import { SimulationRiskFactorsSampling } from '../openapi-internal/SimulationRiskFactorsSampling'
import { LogicAggregationVariable } from '../openapi-internal/LogicAggregationVariable'
import {
  TaskStatusChange,
  TaskStatusChangeStatusEnum,
} from '../openapi-internal/TaskStatusChange'
import { InternalTransaction } from '../openapi-internal/InternalTransaction'
import { SanctionsDataProviderName } from '../openapi-internal/SanctionsDataProviderName'
import { NangoWebhookEvent } from '../openapi-internal/NangoWebhookEvent'
import { SanctionsSettingsProviderScreeningTypes } from '../openapi-internal/SanctionsSettingsProviderScreeningTypes'
import { SanctionsEntityType } from '../openapi-internal/SanctionsEntityType'
import { FlatFileSchema } from '../openapi-internal/FlatFileSchema'
import { FlatFileTemplateFormat } from '../openapi-internal/FlatFileTemplateFormat'
import { DynamoDbClickhouseBackfillBatchJobEntity } from '../openapi-internal/DynamoDbClickhouseBackfillBatchJobEntity'
import { AggregatorName } from '@/services/rules-engine/aggregator'
import { TenantBasic } from '@/services/accounts'
import { TimeRange } from '@/services/dashboard/repositories/types'
import { V8LogicAggregationRebuildTask } from '@/services/rules-engine'
import { ClickhouseTableNames } from '@/utils/clickhouse/definition'

/* Simulation (Pulse) */
export type SimulationRiskLevelsBatchJob = {
  type: 'SIMULATION_PULSE'
  tenantId: string
  parameters: SimulationRiskLevelsParameters & { taskId: string; jobId: string }
  awsCredentials?: Credentials
}

/* Simulation (Risk Scoring V8) */
export type SimulationRiskFactorsV8BatchJob = {
  type: 'SIMULATION_RISK_FACTORS_V8'
  tenantId: string
  parameters: {
    taskId: string
    jobId: string
    sampling: SimulationRiskFactorsSampling
  }
}

/* Simulation (Beacon) */
export type SimulationBeaconBatchJob = {
  type: 'SIMULATION_BEACON'
  tenantId: string
  parameters: SimulationBeaconParameters & {
    taskId: string
    jobId: string
    defaultRuleInstance: RuleInstance
  }
  awsCredentials?: Credentials
}

/* Demo Mode Data Load */
export type DemoModeDataLoadBatchJob = {
  type: 'DEMO_MODE_DATA_LOAD'
  tenantId: string
  awsCredentials?: Credentials
}

/* Sanctions Screening Rule */
export type OngoingScreeningUserRuleBatchJob = {
  type: 'ONGOING_SCREENING_USER_RULE'
  tenantId: string
  from?: string // Optionally process a batch of users from this ID
  to?: string // Optionally process a batch of users to this ID
}

export type PeriodicScreeningUserRuleBatchJob = {
  type: 'PERIODIC_SCREENING_USER_RULE'
  tenantId: string
}

/* Api Usage Metrics */
type ApiUsageMetricsBatchJobParameters = {
  targetMonth: string
  tenantInfos: TenantBasic[]
  googleSheetIds: string[]
}
export type ApiUsageMetricsBatchJob = {
  type: 'API_USAGE_METRICS'
  tenantId: string
  parameters: ApiUsageMetricsBatchJobParameters
}

/* Global rule aggregation */
type GlobalRuleAggregationRebuildBatchJobParameters = {
  userId: string
  aggregatorName: AggregatorName
}
export type GlobalRuleAggregationRebuildBatchJob = {
  type: 'GLOBAL_RULE_AGGREGATION_REBUILD'
  tenantId: string
  parameters: GlobalRuleAggregationRebuildBatchJobParameters
}

/* Rule pre-aggregation */
type RulePreAggregationBatchJobParameters = {
  entity?: V8LogicAggregationRebuildTask['entity']
  currentTimestamp?: number
  aggregationVariables: LogicAggregationVariable[]
}
export type RulePreAggregationMetadata = {
  tasksCount: number
  completeTasksCount: number
}
export type RulePreAggregationBatchJob = {
  type: 'RULE_PRE_AGGREGATION'
  tenantId: string
  parameters: RulePreAggregationBatchJobParameters
  metadata?: RulePreAggregationMetadata
}

/* Manual rule pre-aggregation (for all active rules) */
export type ManualRulePreAggregationBatchJob = {
  type: 'MANUAL_RULE_PRE_AGGREGATION'
  tenantId: string
  currentTimestamp: number
}

/* SLA Status Calculation */
export type AlertSLAStatusRefreshBatchJob = {
  type: 'ALERT_SLA_STATUS_REFRESH'
  tenantId: string
  from?: string
  to?: string
}
/* Case SLA Status Calculation */
export type CaseSLAStatusRefreshBatchJob = {
  type: 'CASE_SLA_STATUS_REFRESH'
  tenantId: string
}

/* Dashboard refresh */
type DashboardRefreshBatchJobParameters = {
  checkTimeRange: TimeRange
}
export type DashboardRefreshBatchJob = {
  type: 'DASHBOARD_REFRESH'
  tenantId: string
  parameters: DashboardRefreshBatchJobParameters
}

/* Cases backfill */
export type CasesBackfillDynamoBatchJob = {
  type: 'CASES_DYNAMO_BACKFILL'
  tenantId: string
}

/* Dynamodb Clickhouse backfill */
export type DynamodbClickhouseBackfillBatchJob = {
  type: 'DYNAMODB_CLICKHOUSE_BACKFILL'
  tenantId: string
  parameters: {
    entity: DynamoDbClickhouseBackfillBatchJobEntity
    saveToClickhouse: boolean
  }
}

/* Sync Indexes */
export type SyncDatabasesBatchJob = {
  type: 'SYNC_DATABASES'
  tenantId: string
}

/* Test Fargate Job */
export type TestFargateJob = {
  type: 'TEST_FARGATE'
  tenantId: string
  parameters: {
    message: string
  }
}

/* Tenant Deletion */
type TenantDeletionBatchJobParameters = {
  notRecoverable: boolean
}
export type TenantDeletionBatchJob = {
  type: 'TENANT_DELETION'
  tenantId: string
  parameters: TenantDeletionBatchJobParameters
}

/* Reverify transactions */
export type ReverifyTransactionsBatchJobParameters = {
  afterTimestamp: number
  beforeTimestamp: number
  ruleInstanceIds: string[]
  extraFilter?: Filter<InternalTransaction>
}
export type ReverifyTransactionsBatchJob = {
  type: 'REVERIFY_TRANSACTIONS'
  tenantId: string
  parameters: ReverifyTransactionsBatchJobParameters
}

export type SanctionsDataFetchBatchJob = {
  type: 'SANCTIONS_DATA_FETCH'
  tenantId: string
  providers: SanctionsDataProviderName[]
  settings?: SanctionsSettingsProviderScreeningTypes[]
  parameters: {
    from?: string
    entityType?: SanctionsEntityType
  }
}

export type DeltaSanctionsDataFetchBatchJob = {
  type: 'DELTA_SANCTIONS_DATA_FETCH'
  tenantId: string
  providers: SanctionsDataProviderName[]
  settings?: SanctionsSettingsProviderScreeningTypes[]
  parameters: {
    from?: string
    ongoingScreeningTenantIds?: string[]
  }
}

export type PnbTransactionEventUpdatesBatchJob = {
  type: 'PNB_TRANSACTION_UPDATES'
  tenantId: string
  parameters: {
    apiKey: string
    publicApiEndpoint: string
    concurrency: number
    s3Key: string
  }
}

export type ClickhouseDataBackfillBatchJob = {
  type: 'CLICKHOUSE_DATA_BACKFILL'
  tenantId: string
  parameters: {
    referenceId: string // if referenceId is provided job will start from the last item of the referenceId
    tableNames: ClickhouseTableNames[]
    type:
      | { type: 'ALL' }
      | { type: 'PARTIAL'; fromTimestamp: number; toTimestamp: number }
  }
}

export type FilesAISummary = {
  type: 'FILES_AI_SUMMARY'
  tenantId: string
  parameters: {
    commentId: string
    type: 'USER' | 'CASE' | 'ALERT'
    entityId: string
  }
  awsCredentials?: Credentials
}

/*  Backfill average TRS score  */
export type BackFillAvgTrs = {
  type: 'BACKFILL_AVERAGE_TRS'
  tenantId: string
}

export type RiskScoringTriggersBatchJob = {
  type: 'RISK_SCORING_RECALCULATION'
  tenantId: string
  parameters: {
    userIds?: string[]
    clearedListIds?: string[]
  }
}

export type BackfillAsyncRuleRuns = {
  type: 'BACKFILL_ASYNC_RULE_RUNS'
  tenantId: string
  parameters: {
    concurrency: number
    type: 'RERUN' | 'NOT_RUN'
    startTimestamp?: number
    affectedExecutionRange?: {
      start: number
      end: number
    }
  }
}

/* PNB specific jobs */
export type PnbBackfillEntities = {
  type: 'PNB_BACKFILL_ENTITIES'
  tenantId: string
  parameters: {
    importFileS3Key: string
    type:
      | 'TRANSACTION'
      | 'CONSUMER'
      | 'BUSINESS'
      | 'TRANSACTION_EVENT'
      | 'CONSUMER_EVENT'
      | 'BUSINESS_EVENT'
    dynamoDbOnly: boolean
  }
}
type PnbBackfillTransactionsBase = {
  tenantId: string
  parameters: {
    cursor:
      | { type: 'START_TIMESTAMP'; value: number }
      | { type: 'IDS'; value: string[] }
    concurrency: number
    publicApiEndpoint: string
    publicApiKey: string
    filters?: Filter<InternalTransaction>
  }
}
export type PnbBackfillTransactions = PnbBackfillTransactionsBase & {
  type: 'PNB_BACKFILL_TRANSACTIONS'
}
export type PnbBackfillArs = PnbBackfillTransactionsBase & {
  type: 'PNB_BACKFILL_ARS'
}
export type PnbBackfillKrs = {
  type: 'PNB_BACKFILL_KRS'
  tenantId: string
  parameters: {
    concurrency: number
    publicApiEndpoint: string
    publicApiKey: string
    cursor:
      | { type: 'START_TIMESTAMP'; value: number }
      | { type: 'IDS'; value: string[] }
  }
}
export type PnbBackfillCra = {
  type: 'PNB_BACKFILL_CRA'
  tenantId: string
  parameters: {
    concurrency: number
    startTimestamp?: number
  }
}
export type PnbBackfillHammerhead = {
  type: 'PNB_BACKFILL_HAMMERHEAD'
  tenantId: string
  parameters: {
    type: 'TRANSACTION' | 'USER'
    concurrency: number
  }
}

export type PnbBackfillWebhookDeliveries = {
  type: 'PNB_BACKFILL_WEBHOOK_DELIVERIES'
  tenantId: string
  parameters: {
    s3Key: string
  }
}

export type FixRiskScoresForPnbUsers = {
  type: 'FIX_RISK_SCORES_FOR_PNB_USERS'
  tenantId: string
  parameters: {
    concurrency: number
  }
}

export type NangoDataFetchBatchJob = {
  type: 'NANGO_DATA_FETCH'
  tenantId: string
  parameters: {
    webhookData: NangoWebhookEvent
    region: string
  }
}

export type WebhookRetryBatchJob = {
  type: 'WEBHOOK_RETRY'
  tenantId: string
}

export type FinCenReportStatusRefreshBatchJob = {
  type: 'FINCEN_REPORT_STATUS_REFRESH'
  tenantId: string
}

export type AggregationCleanupBatchJob = {
  type: 'AGGREGATION_CLEANUP'
  tenantId: string
}

export type InHouseScreeningMigrationBatchJob = {
  type: 'IN_HOUSE_SCREENING_MIGRATION'
  tenantId: string
  parameters: {
    providers: SanctionsDataProviderName[]
    settings: SanctionsSettingsProviderScreeningTypes[]
  }
}

export type SyncAuth0DataBatchJob = {
  type: 'SYNC_AUTH0_DATA'
  tenantId: string
  parameters: { type: 'ALL' } | { type: 'TENANT_IDS'; tenantIds: string[] }
}

export type FailingBatchJob = {
  type: 'FAILING_BATCH_JOB'
  tenantId: string
}

export type FixLocksForKrs = {
  type: 'FIX_LOCKS_FOR_KRS'
  tenantId: string
}
export type FixArsBreakdownBatchJob = {
  type: 'FIX_ARS_BREAKDOWN'
  tenantId: string
}

export type BackFillActionProcessing = {
  type: 'BACKFILL_ACTION_PROCESSING'
  tenantId: string
}

export type QACleanupBatchJob = {
  type: 'QA_CLEANUP'
  tenantId: string
}

export type PnbPullUsersData = {
  type: 'PNB_PULL_USERS_DATA'
  tenantId: string
}

export type UserRuleReRunBatchJob = {
  type: 'USER_RULE_RE_RUN'
  tenantId: string
  parameters: {
    ruleInstanceIds: string[]
  }
}

/* Currently built to be used for preAggregated data 
  and with Sync rebuild aggregation
*/
export type ManualTransactionReverification = {
  type: 'MANUAL_TRANSACTION_REVERIFICATION'
  tenantId: string
  parameters: {
    uniqId: string
    timeRange?: {
      startTime: number
      endTime: number
    }
    concurrency: number
    mongoBatchSize: number
  }
}

export type FlatFilesValidationBatchJob = {
  type: 'FLAT_FILES_VALIDATION'
  tenantId: string
  parameters: {
    s3Key: string
    schema: FlatFileSchema
    format: FlatFileTemplateFormat
    entityId: string
    metadata?: object
  }
}

export type FlatFilesRunnerBatchJob = {
  type: 'FLAT_FILES_RUNNER'
  tenantId: string
  parameters: {
    s3Key: string
    entityId: string
    schema: FlatFileSchema
    format: FlatFileTemplateFormat
    metadata?: object
  }
}

export type SanctionsScreeningDetailsMigrationBatchJob = {
  type: 'SANCTIONS_SCREENING_DETAILS_MIGRATION'
  tenantId: string
}

export type GoCardlessBackfillBatchJob = {
  type: 'GO_CARDLESS_BACKFILL'
  tenantId: string
  parameters: {
    concurrency: number
  }
}

export type BatchJob =
  | SimulationRiskLevelsBatchJob
  | SimulationBeaconBatchJob
  | SimulationRiskFactorsV8BatchJob
  | DemoModeDataLoadBatchJob
  | OngoingScreeningUserRuleBatchJob
  | ApiUsageMetricsBatchJob
  | GlobalRuleAggregationRebuildBatchJob
  | DashboardRefreshBatchJob
  | SyncDatabasesBatchJob
  | TestFargateJob
  | TenantDeletionBatchJob
  | RulePreAggregationBatchJob
  | ManualRulePreAggregationBatchJob
  | FilesAISummary
  | AlertSLAStatusRefreshBatchJob
  | ReverifyTransactionsBatchJob
  | SanctionsDataFetchBatchJob
  | BackFillAvgTrs
  | BackfillAsyncRuleRuns
  | RiskScoringTriggersBatchJob
  | PnbBackfillEntities
  | PnbBackfillTransactions
  | PnbBackfillKrs
  | PnbBackfillArs
  | PnbBackfillCra
  | PnbBackfillHammerhead
  | CaseSLAStatusRefreshBatchJob
  | PnbBackfillWebhookDeliveries
  | FixRiskScoresForPnbUsers
  | WebhookRetryBatchJob
  | NangoDataFetchBatchJob
  | FinCenReportStatusRefreshBatchJob
  | AggregationCleanupBatchJob
  | PnbTransactionEventUpdatesBatchJob
  | InHouseScreeningMigrationBatchJob
  | SyncAuth0DataBatchJob
  | FailingBatchJob
  | FixLocksForKrs
  | FixArsBreakdownBatchJob
  | ClickhouseDataBackfillBatchJob
  | DeltaSanctionsDataFetchBatchJob
  | BackFillActionProcessing
  | CasesBackfillDynamoBatchJob
  | PeriodicScreeningUserRuleBatchJob
  | QACleanupBatchJob
  | PnbPullUsersData
  | DynamodbClickhouseBackfillBatchJob
  | ManualTransactionReverification
  | UserRuleReRunBatchJob
  | FlatFilesValidationBatchJob
  | FlatFilesRunnerBatchJob
  | SanctionsScreeningDetailsMigrationBatchJob
  | GoCardlessBackfillBatchJob

export type BatchJobWithId = BatchJob & {
  jobId: string
}

export type BatchJobInDb = BatchJobWithId & {
  type: BatchJob['type']
  tenantId: string
  latestStatus: TaskStatusChange
  statuses: TaskStatusChange[]
  metadata?: RulePreAggregationMetadata
  parameters?: BatchJobParameters
}

export type BatchJobParameters = {
  sampling?: SimulationRiskFactorsSampling
  ruleInstancesIds?: string[]
  userIds?: string[]
  clearedListIds?: string
  s3Key?: string
}

export type BatchJobParams = {
  type?: BatchJob['type']
  providers?: SanctionsDataProviderName[]
  latestStatus?: {
    status?: TaskStatusChangeStatusEnum
    latestStatusAfterTimestamp?: number
    latestStatusBeforeTimestamp?: number
  }
  parameters?: {
    entityType?: SanctionsEntityType
    entityId?: string
    schema?: FlatFileSchema
  }
  tenantId?: string
  jobId?: {
    equalTo?: string
    notEqualTo?: string
  }
}

export type BatchJobType = BatchJob['type']
// Enforce they all have tenantId
export type _ = BatchJob['tenantId']
