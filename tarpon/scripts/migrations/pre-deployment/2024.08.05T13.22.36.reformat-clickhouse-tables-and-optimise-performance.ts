import { migrateAllTenants } from '../utils/tenant'
import {
  batchInsertToClickhouse,
  createOrUpdateClickHouseTable,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('local') && !envIs('dev')) {
    return
  }
  const clickhouseClient = await getClickhouseClient(tenant.id)
  const mongoClient = await getMongoDbClient()
  const db = mongoClient.db()
  for (const table of ClickHouseTables) {
    const clickhouseTable = table.table
    const checkTableQuery = `DROP TABLE IF EXISTS ${clickhouseTable}`
    await clickhouseClient.query({ query: checkTableQuery })
    for (const matView of table.materializedViews ?? []) {
      const checkMatViewQuery = `DROP VIEW IF EXISTS ${matView.viewName}`
      const dropMatViewTableQuery = `DROP TABLE IF EXISTS ${matView.table}`
      await clickhouseClient.query({ query: checkMatViewQuery })
      await clickhouseClient.query({ query: dropMatViewTableQuery })
    }

    await createOrUpdateClickHouseTable(tenant.id, table)
    const collection = db.collection(`${tenant.id}-${table.table}`)
    const cursor = collection.find()
    const batchSize = 1000
    const batch: any[] = []
    let count = 0

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
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
