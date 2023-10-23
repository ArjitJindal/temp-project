import { DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { logger } from '@/core/logger'
import { TRANSACTION_ID_SUFFIX_DEPLOYED_TIME } from '@/core/dynamodb/dynamodb-keys'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const dynamoDb = getDynamoDbClient()
  const transactionRepository = new DynamoDbTransactionRepository(
    tenant.id,
    dynamoDb
  )
  const cursor = await db
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenant.id))
    .find({
      updatedAt: { $gte: TRANSACTION_ID_SUFFIX_DEPLOYED_TIME.valueOf() },
      createdAt: { $lt: TRANSACTION_ID_SUFFIX_DEPLOYED_TIME.valueOf() },
    })
  for await (const transaction of cursor) {
    logger.info(`Handling transaction ${transaction.transactionId}`)

    const auxiliaryIndexes =
      transactionRepository.getTransactionAuxiliaryIndexes(transaction)
    for (const index of auxiliaryIndexes) {
      const newKey = {
        PartitionKeyID: index.PartitionKeyID,
        SortKeyID: index.SortKeyID,
      }
      const oldKey = {
        PartitionKeyID: index.PartitionKeyID,
        SortKeyID: index.SortKeyID.split('-')[0],
      }
      const resultNew = await dynamoDb.send(
        new GetCommand({
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
          Key: newKey,
        })
      )
      if (resultNew.Item) {
        await dynamoDb.send(
          new DeleteCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
            Key: oldKey,
          })
        )
        logger.info(`Deleted ${JSON.stringify(oldKey)}`)
        const resultOld = await dynamoDb.send(
          new GetCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
            Key: oldKey,
          })
        )
        if (resultOld.Item) {
          throw new Error('Deletion failed')
        }
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
