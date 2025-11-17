import { migrateAllTenants } from '../utils/tenant'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'
import { Tenant } from '@/@types/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
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
    type: 'CLICKHOUSE_DATA_BACKFILL',
    tenantId: tenant.id,
    parameters: {
      type: {
        type: 'PARTIAL',
        fromTimestamp: 1759233600000, // 30 september 2025 12am GMT, when casesubject pr was merged
        toTimestamp: Number.MAX_SAFE_INTEGER,
      },
      tableNames: [ClickhouseTableNames.Transactions],
      referenceId: '0',
    },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
