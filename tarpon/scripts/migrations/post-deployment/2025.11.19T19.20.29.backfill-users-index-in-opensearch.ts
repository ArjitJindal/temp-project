import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { LONG_RUNNING_MIGRATION_TENANT_ID } from '@/utils/batch-job'
import { envIsNot } from '@/utils/env'
import { isOpensearchAvailableInRegion } from '@/utils/opensearch-utils'

export const up = async () => {
  if (envIsNot('prod')) {
    return
  }
  if (!isOpensearchAvailableInRegion()) {
    return
  }
  await sendBatchJobCommand({
    type: 'BACKFILL_OPENSEARCH_USERS_INDEX',
    tenantId: LONG_RUNNING_MIGRATION_TENANT_ID,
  })
}
export const down = async () => {
  // skip
}
