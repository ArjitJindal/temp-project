import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
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
    type: 'DYNAMODB_CLICKHOUSE_BACKFILL',
    tenantId: tenant.id,
    parameters: {
      entity: 'SIMULATION_TASK',
      saveToClickhouse: true,
    },
  })
  await sendBatchJobCommand({
    type: 'DYNAMODB_CLICKHOUSE_BACKFILL',
    tenantId: tenant.id,
    parameters: {
      entity: 'SIMULATION_RESULT',
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
