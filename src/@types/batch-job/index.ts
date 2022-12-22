import { CredentialsOptions } from 'aws-sdk/lib/credentials'
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

/* Placeholder */
type PlaceholderBatchJobType = 'PLACEHOLDER'
export type PlaceholderBatchJob = {
  type: PlaceholderBatchJobType
  tenantId: string
}

export type BatchJobType = FileImportBatchJobType | PlaceholderBatchJobType
export type BatchJob = FileImportBatchJob | PlaceholderBatchJob
