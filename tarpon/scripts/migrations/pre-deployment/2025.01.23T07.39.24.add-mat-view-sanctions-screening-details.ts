import { migrateAllTenants } from '../utils/tenant'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

async function migrateTenant(tenant: Tenant) {
  const clickhouseClient = await getClickhouseClient(tenant.id)

  const migrationQuery = `
    INSERT INTO ${CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.materializedViews.BY_ID.table}
    SELECT id, data FROM ${CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.tableName}
  `

  await clickhouseClient.exec({
    query: migrationQuery,
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
