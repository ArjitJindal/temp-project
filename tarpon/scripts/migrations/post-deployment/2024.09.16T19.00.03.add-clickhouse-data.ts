import { syncClickhouseTables } from '../always-run/sync-clickhouse'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { envIs } from '@/utils/env'
import { batchInsertToClickhouse } from '@/utils/clickhouse/utils'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('dev') && !envIs('local')) {
    console.log('Skipping migration for tenant', tenant.id)
    return
  }

  for (const table of ClickHouseTables) {
    const db = (await getMongoDbClient()).db()
    const collectionName = `${tenant.id}-${
      CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO()[table.table]
    }`
    console.log('Migrating', collectionName)
    const collection = db.collection(collectionName)
    const cursor = collection.find()
    const batchSize = 1000
    const batch: any[] = []
    let count = 0
    const clickhouseTable = table.table
    for await (const doc of cursor) {
      batch.push(doc)
      count++
      if (count % batchSize === 0) {
        await batchInsertToClickhouse(tenant.id, clickhouseTable, batch)
        batch.length = 0 // clear the batch
      }
    }

    await batchInsertToClickhouse(tenant.id, clickhouseTable, batch)
  }
}

export const up = async () => {
  await syncClickhouseTables()
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
