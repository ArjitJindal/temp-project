import _ from 'lodash'
import { StackConstants } from '@cdk/constants'
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import { migrateTransactions } from '../utils/transaction'
import { Tenant } from '@/services/accounts'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { getMongoDbClient, TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }

  const mongodb = await getMongoDbClient()
  const transactionCollection = mongodb
    .db()
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenant.id))
  const transactionsCursor = transactionCollection.find(
    {},
    {
      allowDiskUse: true,
    }
  )
  await migrateTransactions(transactionsCursor, async (transactionsBatch) => {
    for (const transaction of transactionsBatch) {
      const dynamoDb = getDynamoDbClient()
      const oldKey = {
        PartitionKeyID: `${tenant.id}#transaction:${transaction.transactionId}#krs-value`,
        SortKeyID: '1',
      }
      const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
        Key: oldKey,
      }
      const result = await dynamoDb.send(new GetCommand(getItemInput))

      if (result.Item) {
        const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
          TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
          Item: {
            ...DynamoDbKeys.ARS_VALUE_ITEM(
              tenant.id,
              transaction.transactionId,
              '1'
            ),
            ..._.omit(result.Item, ['PartitionKeyID', 'SortKeyID']),
          },
        }
        await dynamoDb.send(new PutCommand(putItemInput))

        const deleteItemInput: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
          TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
          Key: oldKey,
        }
        await dynamoDb.send(new DeleteCommand(deleteItemInput))
      }
    }
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
