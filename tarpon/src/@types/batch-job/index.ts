import { Credentials } from 'aws-lambda'
import { SimulationPulseParameters } from '../openapi-internal/SimulationPulseParameters'
import { SimulationBeaconParameters } from '../openapi-internal/SimulationBeaconParameters'
import { RuleInstance } from '../openapi-internal/RuleInstance'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'
import { AggregatorName } from '@/services/rules-engine/aggregator'
import { TenantBasic } from '@/services/accounts'

/* File Import */
type FileImportBatchJobType = 'FILE_IMPORT'
type FileImportBatchJobParameters = {
  tenantName: string
  importRequest: ImportRequest
}
export type FileImportBatchJob = {
  type: FileImportBatchJobType
  tenantId: string
  parameters: FileImportBatchJobParameters
  awsCredentials?: Credentials
}

/* Simulation (Pulse) */
type SimulationPulseBatchJobType = 'SIMULATION_PULSE'
export type SimulationPulseBatchJob = {
  type: SimulationPulseBatchJobType
  tenantId: string
  parameters: SimulationPulseParameters & { taskId: string; jobId: string }
  awsCredentials?: Credentials
}

/* Simulation (Beacon) */
type SimulationBeaconBatchJobType = 'SIMULATION_BEACON'
export type SimulationBeaconBatchJob = {
  type: SimulationBeaconBatchJobType
  tenantId: string
  parameters: SimulationBeaconParameters & {
    taskId: string
    jobId: string
    defaultRuleInstance: RuleInstance
  }
  awsCredentials?: Credentials
}

/* Demo Mode Data Load */
type DemoModeDataLoadBatchJobType = 'DEMO_MODE_DATA_LOAD'
export type DemoModeDataLoadBatchJob = {
  type: DemoModeDataLoadBatchJobType
  tenantId: string
  parameters: {
    tenantId: string
    defaultTenantIdEndTest: boolean
  }
  awsCredentials?: Credentials
}

/* Placeholder */
type PlaceholderBatchJobType = 'PLACEHOLDER'
export type PlaceholderBatchJob = {
  type: PlaceholderBatchJobType
  tenantId: string
}

/* Sanctions Screening Rule */
type OngoingScreeningUserRuleBatchJobType = 'ONGOING_SCREENING_USER_RULE'
export type OngoingScreeningUserRuleBatchJob = {
  type: OngoingScreeningUserRuleBatchJobType
  tenantId: string
  userIds: string[]
}

/* Pulse Backfill */
type PulseDataLoadBatchJobType = 'PULSE_USERS_BACKFILL_RISK_SCORE'
export type PulseDataLoadBatchJob = {
  type: PulseDataLoadBatchJobType
  tenantId: string
  awsCredentials?: Credentials
}

/* Api Usage Metrics */
type ApiUsageMetricsBatchJobType = 'API_USAGE_METRICS'
export type ApiUsageMetricsBatchJob = {
  type: ApiUsageMetricsBatchJobType
  tenantId: string
  targetMonth: string
  tenantInfos: TenantBasic[]
  googleSheetIds: string[]
}

/* Global rule aggregation */
type GlobalRuleAggregationRebuildBatchJobType =
  'GLOBAL_RULE_AGGREGATION_REBUILD'
type GlobalRuleAggregationRebuildBatchJobParameters = {
  userId: string
  aggregatorName: AggregatorName
}
export type GlobalRuleAggregationRebuildBatchJob = {
  type: GlobalRuleAggregationRebuildBatchJobType
  tenantId: string
  parameters: GlobalRuleAggregationRebuildBatchJobParameters
}

export type BatchJobType =
  | FileImportBatchJobType
  | SimulationPulseBatchJobType
  | PlaceholderBatchJobType
  | DemoModeDataLoadBatchJobType
  | SimulationBeaconBatchJobType
  | OngoingScreeningUserRuleBatchJobType
  | PulseDataLoadBatchJobType
  | ApiUsageMetricsBatchJobType
  | GlobalRuleAggregationRebuildBatchJobType

export type BatchJob =
  | FileImportBatchJob
  | SimulationPulseBatchJob
  | PlaceholderBatchJob
  | DemoModeDataLoadBatchJob
  | SimulationBeaconBatchJob
  | OngoingScreeningUserRuleBatchJob
  | PulseDataLoadBatchJob
  | ApiUsageMetricsBatchJob
  | GlobalRuleAggregationRebuildBatchJob
