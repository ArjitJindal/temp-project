import { v4 as uuidv4 } from 'uuid'
import { migrateAllTenants } from '../utils/tenant'
import { SyncAuth0DataRunner } from '@/services/batch-jobs/sync-auth0-data'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant) {
  const jobId = uuidv4()
  const syncAuth0DataRunner = new SyncAuth0DataRunner(jobId)
  await syncAuth0DataRunner.execute({
    type: 'SYNC_AUTH0_DATA',
    tenantId: tenant.id,
    parameters: { type: 'ALL' },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
