import { CredentialsOptions } from 'aws-sdk/lib/credentials'
import { SimulationPulseParameters } from '../openapi-internal/SimulationPulseParameters'
import { SimulationBeaconParameters } from '../openapi-internal/SimulationBeaconParameters'
import { RuleInstance } from '../openapi-internal/RuleInstance'
import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'

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
  awsCredentials?: CredentialsOptions
}

/* Simulation (Pulse) */
type SimulationPulseBatchJobType = 'SIMULATION_PULSE'
export type SimulationPulseBatchJob = {
  type: SimulationPulseBatchJobType
  tenantId: string
  parameters: SimulationPulseParameters & { taskId: string; jobId: string }
  awsCredentials?: CredentialsOptions
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
  awsCredentials?: CredentialsOptions
}

/* Demo Mode Data Load */
type DemoModeDataLoadBatchJobType = 'DEMO_MODE_DATA_LOAD'
export type DemoModeDataLoadBatchJob = {
  type: DemoModeDataLoadBatchJobType
  tenantId: string
  awsCredentials?: CredentialsOptions
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
  awsCredentials?: CredentialsOptions
}

export type BatchJobType =
  | FileImportBatchJobType
  | SimulationPulseBatchJobType
  | PlaceholderBatchJobType
  | DemoModeDataLoadBatchJobType
  | SimulationBeaconBatchJobType
  | OngoingScreeningUserRuleBatchJobType
  | PulseDataLoadBatchJobType

export type BatchJob =
  | FileImportBatchJob
  | SimulationPulseBatchJob
  | PlaceholderBatchJob
  | DemoModeDataLoadBatchJob
  | SimulationBeaconBatchJob
  | OngoingScreeningUserRuleBatchJob
  | PulseDataLoadBatchJob
