import { syncClickhouseTables } from '../always-run/sync-clickhouse'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ClickHouseTables } from '@/utils/clickhouse-definition'
import { envIs } from '@/utils/env'
import {
  batchInsertToClickhouse,
  sanitizeTableName,
} from '@/utils/clickhouse-utils'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('dev')) {
    console.log('Skipping migration for tenant', tenant.id)
    return
  }

  for (const table of ClickHouseTables) {
    const db = (await getMongoDbClient()).db()
    const collection = db.collection(`${tenant.id}-${table.table}`)
    const cursor = collection.find()
    const batchSize = 1000
    const batch: any[] = []
    let count = 0
    const clickhouseTable = sanitizeTableName(`${tenant.id}-${table.table}`)
    for await (const doc of cursor) {
      batch.push(doc)
      count++
      if (count % batchSize === 0) {
        await batchInsertToClickhouse(clickhouseTable, batch, tenant.id)
        batch.length = 0 // clear the batch
      }
    }

    await batchInsertToClickhouse(clickhouseTable, batch, tenant.id)
  }
}

export const up = async () => {
  await syncClickhouseTables()
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
