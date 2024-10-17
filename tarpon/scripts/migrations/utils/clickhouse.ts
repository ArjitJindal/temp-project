import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import { batchInsertToClickhouse } from '@/utils/clickhouse/utils'
import {
  CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO,
  ClickhouseTableDefinition,
} from '@/utils/clickhouse/definition'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export async function syncClickhouseTableWithMongo(
  tenantId: string,
  table: ClickhouseTableDefinition
) {
  const mongoClient = await getMongoDbClient()
  const db = mongoClient.db()
  const mongoTable = CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO()[table.table]
  const collectionName = `${tenantId}-${mongoTable}`
  const collection = db.collection(collectionName)
  const cursor = collection.find()
  const batchSize = 10000
  const batch: any[] = []
  let count = 0
  const clickhouseTable = table.table
  for await (const doc of cursor) {
    batch.push(doc)
    count++
    if (count % batchSize === 0) {
      const trasformedData = await new MongoDbConsumer(
        mongoClient
      ).updateInsertMessages(mongoTable, batch)
      await batchInsertToClickhouse(tenantId, clickhouseTable, trasformedData)
      batch.length = 0 // clear the batch
    }
  }

  const trasformedData = await new MongoDbConsumer(
    mongoClient
  ).updateInsertMessages(mongoTable, batch)
  await batchInsertToClickhouse(tenantId, clickhouseTable, trasformedData)
}
