import { migrateAllTenants } from '../utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { Tenant } from '@/services/accounts/repository'
import { envIs } from '@/utils/env'
import { MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE } from '@/utils/clickhouse/definition'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('prod:me-1')) {
    return
  }

  await sendBatchJobCommand({
    tenantId: tenant.id,
    type: 'CLICKHOUSE_DATA_BACKFILL',
    parameters: {
      type: { type: 'ALL' },
      tableNames: Object.values(MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE),
      referenceId: tenant.id,
    },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}
