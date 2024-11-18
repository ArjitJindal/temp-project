import { migrateAllTenants } from '../utils/tenant'
import {
  getClickhouseClient,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

async function migrateTenant(tenant: Tenant) {
  if (isClickhouseEnabledInRegion()) {
    const clickhouse = await getClickhouseClient(tenant.id)

    try {
      await clickhouse.exec({
        query: `INSERT INTO ${CLICKHOUSE_DEFINITIONS.USERS.materializedViews.BY_ID.table} (id, data) SELECT id, data FROM ${CLICKHOUSE_DEFINITIONS.USERS.tableName}`,
      })
    } catch (error) {
      console.error(error)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
