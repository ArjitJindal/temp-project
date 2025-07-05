import {
  LONG_RUNNING_MIGRATION_TENANT_ID,
  sendBatchJobCommand,
} from '@/services/batch-jobs/batch-job'

export const up = async () => {
  await sendBatchJobCommand({
    type: 'SANCTIONS_SCREENING_DETAILS_MIGRATION',
    tenantId: LONG_RUNNING_MIGRATION_TENANT_ID,
  })
}
export const down = async () => {
  // skip
}
