import { Credentials } from 'aws-lambda'
import { Filter } from 'mongodb'
import { SimulationRiskLevelsParameters } from '../openapi-internal/SimulationRiskLevelsParameters'
import { SimulationBeaconParameters } from '../openapi-internal/SimulationBeaconParameters'
import { RuleInstance } from '../openapi-internal/RuleInstance'
import { SimulationRiskFactorsSampling } from '../openapi-internal/SimulationRiskFactorsSampling'
import { LogicAggregationVariable } from '../openapi-internal/LogicAggregationVariable'
import { TaskStatusChange } from '../openapi-internal/TaskStatusChange'
import { InternalTransaction } from '../openapi-internal/InternalTransaction'
import { SanctionsDataProviderName } from '../openapi-internal/SanctionsDataProviderName'
import { NangoWebhookEvent } from '../openapi-internal/NangoWebhookEvent'
import { AggregatorName } from '@/services/rules-engine/aggregator'
import { TenantBasic } from '@/services/accounts'
import { TimeRange } from '@/services/dashboard/repositories/types'
import { V8LogicAggregationRebuildTask } from '@/services/rules-engine'

/* Simulation (Pulse) */
export type SimulationRiskLevelsBatchJob = {
  type: 'SIMULATION_PULSE'
  tenantId: string
  parameters: SimulationRiskLevelsParameters & { taskId: string; jobId: string }
  awsCredentials?: Credentials
}

/* Simulation (Risk Scoring) */
export type SimulationRiskFactorsBatchJob = {
  type: 'SIMULATION_RISK_FACTORS'
  tenantId: string
  parameters: {
    taskId: string
    jobId: string
    sampling: SimulationRiskFactorsSampling
  }
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

/* Pulse Backfill */
export type PulseDataLoadBatchJob = {
  type: 'PULSE_USERS_BACKFILL_RISK_SCORE'
  tenantId: string
  parameters: {
    userIds: string[]
  }
  awsCredentials?: Credentials
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
  provider: SanctionsDataProviderName
  parameters: {
    from?: string
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

export type BatchJob =
  | SimulationRiskLevelsBatchJob
  | SimulationRiskFactorsBatchJob
  | SimulationBeaconBatchJob
  | SimulationRiskFactorsV8BatchJob
  | DemoModeDataLoadBatchJob
  | OngoingScreeningUserRuleBatchJob
  | PulseDataLoadBatchJob
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

export type BatchJobWithId = BatchJob & {
  jobId: string
}

export type BatchJobInDb = BatchJobWithId & {
  latestStatus: TaskStatusChange
  statuses: TaskStatusChange[]
}

export type BatchJobType = BatchJob['type']
// Enforce they all have tenantId
export type _ = BatchJob['tenantId']
