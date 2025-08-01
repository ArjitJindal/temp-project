import { WithId, Document } from 'mongodb'
import { BatchJobRunner } from './batch-job-runner-base'
import { BackfillTransactionsDescBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import { batchInsertToClickhouse } from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { logger } from '@/core/logger'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

export class BackfillTransactionsDescBatchJobRunner extends BatchJobRunner {
  protected async run(job: BackfillTransactionsDescBatchJob): Promise<void> {
    const { tenantId, parameters } = job
    const { batchSize = 10000 } = parameters

    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const db = mongoDb.db()
    const mongoDbConsumer = new MongoDbConsumer(mongoDb, dynamoDb)

    logger.info(
      `Starting transactions_desc backfill with batch size ${batchSize}`
    )

    // Get MongoDB transactions collection
    const mongoCollectionName = TRANSACTIONS_COLLECTION(tenantId)
    const mongoCollection = db.collection<WithId<Document>>(mongoCollectionName)

    // Get total document count for progress tracking
    const totalDocuments = await mongoCollection.estimatedDocumentCount()
    logger.info(`Total transactions to process: ${totalDocuments}`)

    if (totalDocuments === 0) {
      logger.info('No transactions found, skipping backfill')
      return
    }

    // Process documents in batches using cursor
    const cursor = mongoCollection.find({}).batchSize(batchSize)
    let processedCount = 0
    let batch: WithId<Document>[] = []

    for await (const doc of cursor) {
      batch.push(doc)

      if (batch.length >= batchSize) {
        await this.processBatch(mongoDbConsumer, tenantId, batch)

        processedCount += batch.length
        batch = []

        logger.info(
          `Processed ${processedCount}/${totalDocuments} transactions`
        )
      }
    }

    // Process remaining documents in the final batch
    if (batch.length > 0) {
      await this.processBatch(mongoDbConsumer, tenantId, batch)

      processedCount += batch.length
      logger.info(
        `Processed ${processedCount}/${totalDocuments} transactions (final batch)`
      )
    }

    logger.info(
      `Transactions_desc backfill completed: ${processedCount} documents`
    )
  }

  private async processBatch(
    mongoDbConsumer: MongoDbConsumer,
    tenantId: string,
    batch: WithId<Document>[]
  ): Promise<void> {
    try {
      // Transform the documents using the same logic as the consumer
      const transformedDocuments = await mongoDbConsumer.updateInsertMessages(
        'transactions',
        batch
      )

      // Insert directly into transactions_desc table only
      await batchInsertToClickhouse(
        tenantId,
        CLICKHOUSE_DEFINITIONS.TRANSACTIONS_DESC.tableName,
        transformedDocuments
      )

      logger.debug(
        `Successfully inserted batch of ${batch.length} documents to transactions_desc`
      )
    } catch (error) {
      logger.error(`Failed to process batch for transactions_desc:`, error)
      throw error
    }
  }
}
