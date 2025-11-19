import { MongoClient, WithId, Document } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { processCursorInBatch } from '@/utils/mongodb-utils'
import { DynamoTransactionBatch, sanitizeMongoObject } from '@/utils/dynamodb'

type DynamoDbKey = {
  PartitionKeyID: string
  SortKeyID: string
}

type KeyGenerator = (tenantId: string, doc: Document) => DynamoDbKey

type backfillCollectionParams = {
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  tenantId: string
  mongoBatchSize?: number
  processBatchSize?: number
  collectionName: string
  keyGenerator: KeyGenerator
}

export const backfillCollection = async ({
  mongoDb,
  dynamoDb,
  tenantId,
  mongoBatchSize = 1000,
  processBatchSize = 1000,
  collectionName,
  keyGenerator,
}: backfillCollectionParams) => {
  const db = mongoDb.db()
  if (!collectionName) {
    return
  }
  const collection = db.collection<Document>(collectionName)
  const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  await processCursorInBatch(
    collection.find({}).addCursorFlag('noCursorTimeout', true),
    async (docs: (Document | WithId<Document>)[]) => {
      const batch = new DynamoTransactionBatch(dynamoDb, tableName)

      for (const doc of docs) {
        const withIdDoc = doc as WithId<Document>
        const sanitized = sanitizeMongoObject(withIdDoc)
        const dynamoKey = keyGenerator(tenantId, doc)
        batch.put({
          Item: {
            ...dynamoKey,
            ...sanitized,
          },
        })
      }

      await batch.execute()
    },
    { mongoBatchSize, processBatchSize, debug: true }
  )
}
