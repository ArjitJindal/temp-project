import { chunk } from 'lodash'
import { MongoClient } from 'mongodb'
import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import { batchInsertToClickhouse } from '@/utils/clickhouse/utils'
import {
  CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO,
  ClickhouseTableDefinition,
} from '@/utils/clickhouse/definition'
import { logger } from '@/core/logger'

export async function syncClickhouseTableWithMongo(
  mongoClient: MongoClient,
  tenantId: string,
  table: ClickhouseTableDefinition
) {
  const db = mongoClient.db()
  const mongoTable = CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO()[table.table]
  const collectionName = `${tenantId}-${mongoTable}`
  const collection = db.collection(collectionName)
  const batchSize = 50_000
  const chunkSize = 1000
  const allDocumentsCount = await collection.estimatedDocumentCount()
  let totalCount = 0
  const cursor = collection.find().batchSize(batchSize)
  const batch: any[] = []
  const clickhouseTable = table.table
  const startTime = Date.now()
  let estimatedTimeLeft = 0
  const mongoDbConsumer = new MongoDbConsumer(mongoClient)

  for await (const doc of cursor) {
    batch.push(doc)
    totalCount++
    if (totalCount % chunkSize === 0) {
      const trasformedData = await mongoDbConsumer.updateInsertMessages(
        mongoTable,
        batch
      )
      const chunkBatch = chunk(trasformedData, chunkSize)
      await Promise.all(
        chunkBatch.map(async (chunk) => {
          await batchInsertToClickhouse(tenantId, clickhouseTable, chunk)
        })
      )
      batch.length = 0 // clear the batch
      const currentTime = Date.now()
      const elapsedTime = (currentTime - startTime) / 1000
      estimatedTimeLeft =
        (elapsedTime / totalCount) * (allDocumentsCount - totalCount)
      logger.info(
        `Estimated time left: ${estimatedTimeLeft} seconds for ${totalCount} documents`
      )
    }
    logger.info(
      `Processed document ${totalCount} of ${allDocumentsCount} with ${estimatedTimeLeft} seconds left for ${table.table}`
    )
  }

  const trasformedData = await new MongoDbConsumer(
    mongoClient
  ).updateInsertMessages(mongoTable, batch)
  await batchInsertToClickhouse(tenantId, clickhouseTable, trasformedData)
}

export async function syncClickhouseTablesWithMongo(
  tenantId: string,
  tables: ClickhouseTableDefinition[],
  mongoClient: MongoClient
) {
  await Promise.all(
    tables.map((table) =>
      syncClickhouseTableWithMongo(mongoClient, tenantId, table)
    )
  )
}
