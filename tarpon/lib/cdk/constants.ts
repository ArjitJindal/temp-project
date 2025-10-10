export type BatchRunType = 'LAMBDA' | 'FARGATE'

export const LAMBDA_BATCH_JOB_RUN_TYPE: BatchRunType = 'LAMBDA'
export const FARGATE_BATCH_JOB_RUN_TYPE: BatchRunType = 'FARGATE'
export const BATCH_JOB_RUN_TYPE_RESULT_KEY = 'BatchJobRunType'
export const BATCH_JOB_PAYLOAD_RESULT_KEY = 'BatchJobPayload'
export const BATCH_JOB_ID_ENV_VAR = 'BATCH_JOB_ID'
export const BATCH_JOB_TENANT_ID_ENV_VAR = 'BATCH_JOB_TENANT_ID'
