import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { LONG_RUNNING_MIGRATION_TENANT_ID } from '@/utils/batch-job'

export const up = async () => {
  await sendBatchJobCommand({
    type: 'SANCTIONS_SCREENING_DETAILS_MIGRATION',
    tenantId: LONG_RUNNING_MIGRATION_TENANT_ID,
  })
}
export const down = async () => {
  // skip
}
