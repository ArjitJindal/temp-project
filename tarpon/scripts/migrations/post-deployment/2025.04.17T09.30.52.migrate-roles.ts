import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

export const up = async () => {
  await sendBatchJobCommand({
    tenantId: 'flagright',
    type: 'SYNC_AUTH0_DATA',
    parameters: {
      type: 'ALL',
    },
  })
}
export const down = async () => {
  // skip
}
