import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { isDemoTenant } from '@/utils/tenant-id'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'

async function migrateTenant(tenant: Tenant) {
  if (isDemoTenant(tenant.id)) {
    return
  }

  if (!isClickhouseEnabledInRegion()) {
    return
  }
  await sendBatchJobCommand({
    type: 'DYNAMODB_CLICKHOUSE_BACKFILL',
    tenantId: tenant.id,
    parameters: {
      entity: 'GPT_REQUEST_LOGS',
      saveToClickhouse: true,
    },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
