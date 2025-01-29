import { v4 as uuidv4 } from 'uuid'
import { SyncAuth0DataRunner } from '@/services/batch-jobs/sync-auth0-data'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

export const up = async () => {
  const jobId = uuidv4()
  const syncAuth0DataRunner = new SyncAuth0DataRunner(jobId)
  await syncAuth0DataRunner.execute({
    type: 'SYNC_AUTH0_DATA',
    tenantId: FLAGRIGHT_TENANT_ID,
    parameters: { type: 'ALL' },
  })
}
export const down = async () => {
  // skip
}
