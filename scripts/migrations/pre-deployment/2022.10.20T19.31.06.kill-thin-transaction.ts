import { StackConstants } from '@cdk/constants'
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { Transaction } from '@/@types/openapi-public/Transaction'

export async function migrateTenant(
  tenant: Tenant,
  afterTimestamp: number,
  beforeTimestamp: number
) {
  console.info(`Starting to migrate tenant ${tenant.name} (ID: ${tenant.id})`)
  const dynamoDb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const transactionCollection = mongodb
    .db()
    .collection<TransactionCaseManagement>(TRANSACTIONS_COLLECTION(tenant.id))
  let migratedCount = 0
  const transactionRepository = new TransactionRepository(tenant.id, {
    dynamoDb,
  })
  const transactionsCursor = transactionCollection.find(
    {
      timestamp: {
        $lte: beforeTimestamp,
        $gte: afterTimestamp,
      },
    },
    {
      projection: Object.fromEntries(
        Transaction.attributeTypeMap.map((attribute) => [attribute.name, 1])
      ),
      allowDiskUse: true,
    }
  )

  for await (const transaction of transactionsCursor) {
    const writeRequests = transactionRepository
      .getTransactionAuxiliaryIndices(_.omit(transaction, '_id'))
      .map((item) => ({
        PutRequest: {
          Item: item,
        },
      }))
    if (writeRequests.length > 0) {
      const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
        {
          RequestItems: {
            [StackConstants.TARPON_DYNAMODB_TABLE_NAME]: writeRequests,
          },
        }
      await dynamoDb.send(new BatchWriteCommand(batchWriteItemParams))

      console.info(`Migrated transaction ${transaction.transactionId}`)
      migratedCount += 1
    }
  }
  console.info(`Migrated ${migratedCount} transactions`)
}

export const up = async () => {
  // We don't backfill non-prod envs
  if (process.env.ENV?.startsWith('prod')) {
    await migrateAllTenants((tenant) =>
      migrateTenant(tenant, 0, new Date('2022-10-26').valueOf())
    )
  }
}

export const down = async () => {
  // skip
}
