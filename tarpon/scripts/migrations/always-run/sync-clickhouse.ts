import { ClickHouseTables } from '../../../src/utils/clickhouse-definition'
import { createOrUpdateClickHouseTable } from '../../../src/utils/clickhouse-utils'
import { migrateAllTenants } from '../utils/tenant'

export async function syncClickhouseTables() {
  await migrateAllTenants(async (tenant) => {
    await Promise.all(
      ClickHouseTables.map((table) =>
        createOrUpdateClickHouseTable(tenant.id, table)
      )
    )
  })
}
