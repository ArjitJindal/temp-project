import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/utils'

async function migrateTenant(tenant: Tenant) {
  if (
    tenant.id !== 'sia-partners' &&
    tenant.id !== 'sia-partners-test' &&
    tenant.id !== 'ffe367a89f' &&
    tenant.id !== 'ffe367a89f-test'
  ) {
    return
  }

  if (!isClickhouseEnabledInRegion()) {
    return
  }
  await sendBatchJobCommand({
    type: 'DYNAMODB_CLICKHOUSE_BACKFILL',
    tenantId: tenant.id,
    parameters: {
      entity: 'CASES',
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
