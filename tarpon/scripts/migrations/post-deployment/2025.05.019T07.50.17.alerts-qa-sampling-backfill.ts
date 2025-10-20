import { migrateAllTenants } from '../utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { Tenant } from '@/@types/tenant'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { isDemoTenant } from '@/utils/tenant-id'

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
      entity: 'ALERTS_QA_SAMPLING',
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
