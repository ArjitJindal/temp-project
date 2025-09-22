import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { LONG_RUNNING_MIGRATION_TENANT_ID } from '@/utils/batch-job'
import { envIsNot } from '@/utils/env'

export const up = async () => {
  if (envIsNot('prod')) {
    return
  }
  await sendBatchJobCommand({
    type: 'AGGREGATION_CLEANUP',
    tenantId: LONG_RUNNING_MIGRATION_TENANT_ID,
  })
}
export const down = async () => {
  // skip
}
