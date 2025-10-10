import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

export const up = async () => {
  const tenantId = '3227d9c851'
  await sendBatchJobCommand({
    tenantId: tenantId,
    type: 'FIX_ARS_BREAKDOWN',
  })
}
export const down = async () => {
  // skip
}
