import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

export async function syncAccountsLocally() {
  await sendBatchJobCommand({
    type: 'SYNC_AUTH0_DATA',
    tenantId: FLAGRIGHT_TENANT_ID,
    parameters: { type: 'ALL' },
  })
}
