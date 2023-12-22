import { Credentials } from 'aws-lambda'
import { SimulationPulseParameters } from '../openapi-internal/SimulationPulseParameters'
import { SimulationBeaconParameters } from '../openapi-internal/SimulationBeaconParameters'
import { RuleInstance } from '../openapi-internal/RuleInstance'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'
import { AggregatorName } from '@/services/rules-engine/aggregator'
import { TenantBasic } from '@/services/accounts'
import { TimeRange } from '@/lambdas/console-api-dashboard/repositories/types'

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
export type SimulationPulseBatchJob = {
  type: 'SIMULATION_PULSE'
  tenantId: string
  parameters: SimulationPulseParameters & { taskId: string; jobId: string }
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
  userIds: string[]
}

/* Pulse Backfill */
export type PulseDataLoadBatchJob = {
  type: 'PULSE_USERS_BACKFILL_RISK_SCORE'
  tenantId: string
  awsCredentials?: Credentials
}

/* Api Usage Metrics */
export type ApiUsageMetricsBatchJob = {
  type: 'API_USAGE_METRICS'
  tenantId: string
  targetMonth: string
  tenantInfos: TenantBasic[]
  googleSheetIds: string[]
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

export type BatchJob =
  | FileImportBatchJob
  | SimulationPulseBatchJob
  | DemoModeDataLoadBatchJob
  | SimulationBeaconBatchJob
  | OngoingScreeningUserRuleBatchJob
  | PulseDataLoadBatchJob
  | ApiUsageMetricsBatchJob
  | GlobalRuleAggregationRebuildBatchJob
  | DashboardRefreshBatchJob
  | OngoingMerchantMonitoringBatchJob
  | SyncIndexesBatchJob
  | TestFargateJob

export type BatchJobType = BatchJob['type']
// Enforce they all have tenantId
export type _ = BatchJob['tenantId']
