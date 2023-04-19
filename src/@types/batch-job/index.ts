import { CredentialsOptions } from 'aws-sdk/lib/credentials'
import { SimulationPulseParameters } from '../openapi-internal/SimulationPulseParameters'
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
}

export type BatchJobType =
  | FileImportBatchJobType
  | SimulationPulseBatchJobType
  | PlaceholderBatchJobType
  | DemoModeDataLoadBatchJobType
  | OngoingScreeningUserRuleBatchJobType

export type BatchJob =
  | FileImportBatchJob
  | SimulationPulseBatchJob
  | PlaceholderBatchJob
  | DemoModeDataLoadBatchJob
  | OngoingScreeningUserRuleBatchJob
