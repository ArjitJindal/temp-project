import { Credentials } from 'aws-lambda'
import { SimulationRiskLevelsParameters } from '../openapi-internal/SimulationRiskLevelsParameters'
import { SimulationBeaconParameters } from '../openapi-internal/SimulationBeaconParameters'
import { RuleInstance } from '../openapi-internal/RuleInstance'
import { SimulationRiskFactorsSampling } from '../openapi-internal/SimulationRiskFactorsSampling'
import { RuleAggregationVariable } from '../openapi-internal/RuleAggregationVariable'
import { TaskStatusChange } from '../openapi-internal/TaskStatusChange'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'
import { AggregatorName } from '@/services/rules-engine/aggregator'
import { TenantBasic } from '@/services/accounts'
import { TimeRange } from '@/services/dashboard/repositories/types'

/* File Import */
type FileImportBatchJobParameters = {
  tenantName: string
  importRequest: ImportRequest
}
export type FileImportBatchJob = {
  type: 'FILE_IMPORT'
  tenantId: string
  parameters: FileImportBatchJobParameters
  awsCredentials?: Credentials
}

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
}

/* Pulse Backfill */
export type PulseDataLoadBatchJob = {
  type: 'PULSE_USERS_BACKFILL_RISK_SCORE'
  tenantId: string
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
  ruleInstanceId: string
  aggregationVariables: RuleAggregationVariable[]
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

/* Dashboard refresh */
type DashboardRefreshBatchJobParameters = {
  checkTimeRange: TimeRange
}
export type DashboardRefreshBatchJob = {
  type: 'DASHBOARD_REFRESH'
  tenantId: string
  parameters: DashboardRefreshBatchJobParameters
}

/* Merchant Monitoring */
export type OngoingMerchantMonitoringBatchJob = {
  type: 'ONGOING_MERCHANT_MONITORING'
  tenantId: string
}

/* Sync Indexes */
export type SyncIndexesBatchJob = {
  type: 'SYNC_INDEXES'
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

export type BatchJob =
  | FileImportBatchJob
  | SimulationRiskLevelsBatchJob
  | SimulationRiskFactorsBatchJob
  | SimulationBeaconBatchJob
  | DemoModeDataLoadBatchJob
  | OngoingScreeningUserRuleBatchJob
  | PulseDataLoadBatchJob
  | ApiUsageMetricsBatchJob
  | GlobalRuleAggregationRebuildBatchJob
  | DashboardRefreshBatchJob
  | OngoingMerchantMonitoringBatchJob
  | SyncIndexesBatchJob
  | TestFargateJob
  | TenantDeletionBatchJob
  | RulePreAggregationBatchJob
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
