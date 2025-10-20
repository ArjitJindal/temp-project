import { ClickHouseTables } from './definition'
import { createDbIfNotExists, createOrUpdateClickHouseTable } from './utils'

export async function createTenantDatabase(tenantId: string) {
  await createDbIfNotExists(tenantId)

  for (const table of ClickHouseTables) {
    const database = table.database ?? (tenantId === 'default' ? '' : tenantId)
    if (database !== tenantId) {
      continue
    }
    await createOrUpdateClickHouseTable(tenantId, table, {
      skipDefaultClient: true,
    })
  }
}
