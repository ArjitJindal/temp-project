import { migrateAllTenants } from '../utils/tenant'
import { syncClickhouseTables } from '../always-run/sync-clickhouse'
import { sanitizeTableName } from '../../../src/utils/clickhouse-utils'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { ClickHouseTables } from '@/utils/clickhouse-definition'
import { envIs } from '@/utils/env'
import { batchInsertToClickhouse } from '@/utils/clickhouse-utils'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('dev')) {
    return
  }

  for (const table of ClickHouseTables) {
    const db = (await getMongoDbClient()).db()
    const collection = db.collection(
      sanitizeTableName(`${tenant.id}-${table.table}`)
    )
    await processCursorInBatch(
      collection.find({}),
      async (items) => {
        await batchInsertToClickhouse(table.table, items)
      },
      {
        mongoBatchSize: 1000,
      }
    )
  }
}

export const up = async () => {
  await syncClickhouseTables()
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
