import { BatchJobWithId } from '@/@types/batch-job'

export const LONG_RUNNING_MIGRATION_TENANT_ID = 'long-running-migration'

export function getBatchJobName(job: BatchJobWithId) {
  return `${job.tenantId}-${job.type}-${job.jobId}`.slice(0, 80)
}
