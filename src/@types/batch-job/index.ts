import { CredentialsOptions } from 'aws-sdk/lib/credentials'
import { LiveTestPulseParameters } from '../openapi-internal/LiveTestPulseParameters'
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

/* Live Testing (Pulse) */
type LiveTestingPulseBatchJobType = 'LIVE_TESTING_PULSE'
export type LiveTestingPulseBatchJob = {
  type: LiveTestingPulseBatchJobType
  tenantId: string
  parameters: LiveTestPulseParameters & { taskId: string }
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

export type BatchJobType =
  | FileImportBatchJobType
  | LiveTestingPulseBatchJobType
  | PlaceholderBatchJobType
  | DemoModeDataLoadBatchJobType
export type BatchJob =
  | FileImportBatchJob
  | LiveTestingPulseBatchJob
  | PlaceholderBatchJob
  | DemoModeDataLoadBatchJob
