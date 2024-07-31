import { ClickHouseTables } from '../../../src/utils/clickhouse-definition'
import { createOrUpdateClickHouseTable } from '../../../src/utils/clickhouse-utils'
import { migrateAllTenants } from '../utils/tenant'
import { envIs } from '@/utils/env'

export async function syncClickhouseTables() {
  if (envIs('local') || envIs('dev')) {
    await migrateAllTenants(async (tenant) => {
      await Promise.all(
        ClickHouseTables.map((table) =>
          createOrUpdateClickHouseTable(tenant.id, table)
        )
      )
    })
  }
}
