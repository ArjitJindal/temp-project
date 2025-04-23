import { migrateAllTenants } from '../utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { Tenant } from '@/services/accounts/repository'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/utils'
import { isDemoTenant } from '@/utils/tenant'

async function migrateTenant(tenant: Tenant) {
  if (isDemoTenant(tenant.id)) {
    return
  }

  if (!isClickhouseEnabledInRegion()) {
    return
  }
  await sendBatchJobCommand({
    type: 'CASES_DYNAMO_BACKFILL',
    tenantId: tenant.id,
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
