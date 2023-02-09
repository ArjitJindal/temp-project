import { StackConstants } from '@cdk/constants'
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { migrateTransactions } from '../utils/transaction'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  getMongoDbClient,
  MIGRATION_TMP_COLLECTION,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { Transaction } from '@/@types/openapi-public/Transaction'

export async function migrateTenant(
  tenant: Tenant,
  afterTimestamp: number,
  beforeTimestamp: number,
  migrationKey: string
) {
  console.info(
    `${new Date().toISOString()} Starting to migrate tenant ${
      tenant.name
    } (ID: ${tenant.id})`
  )
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const migrationProgress = await mongodb
    .db()
    .collection(MIGRATION_TMP_COLLECTION)
    .findOne({ _id: migrationKey })
  const lastCompletedTimestamp = migrationProgress?.lastCompletedTimestamp

  const transactionCollection = mongodb
    .db()
    .collection<TransactionCaseManagement>(TRANSACTIONS_COLLECTION(tenant.id))
  const filter = {
    timestamp: {
      $lte: beforeTimestamp,
      $gte: lastCompletedTimestamp
        ? lastCompletedTimestamp + 1
        : afterTimestamp,
    },
  }
  const transactionsCursor = transactionCollection.find(filter, {
    sort: { tiemstamp: 1 },
    projection: Object.fromEntries(
      Transaction.attributeTypeMap.map((attribute) => [attribute.name, 1])
    ),
    allowDiskUse: true,
  })
  const totalTransactions = await transactionCollection.count(filter)

  await migrateTransactions(transactionsCursor, async (transactionsBatch) => {
    let batch = 0
    let transactionsCount = 0
    const CHUNK_SIZE = 10
    const mongodb = await getMongoDbClient(
      StackConstants.MONGO_DB_DATABASE_NAME
    )
    for (const transactionsChunk of _.chunk(transactionsBatch, CHUNK_SIZE)) {
      const dynamoDb = getDynamoDbClient()
      const transactionRepository = new TransactionRepository(tenant.id, {
        dynamoDb,
      })
      batch += 1
      await Promise.all(
        transactionsChunk.map(async (transaction) => {
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
          }
        })
      )
      transactionsCount += transactionsBatch.length
      console.info(
        `${new Date().toISOString()} Migrated transactions (${transactionsCount} / ${totalTransactions} )`
      )
      if (batch % 100 === 0) {
        // Persisnt migration progress then we don't re-migrate the transaction on re-try
        await mongodb
          .db()
          .collection(MIGRATION_TMP_COLLECTION)
          .replaceOne(
            {
              _id: migrationKey,
            },
            { lastCompletedTimestamp: _.last(transactionsChunk)?.timestamp },
            { upsert: true }
          )
      }
    }
  })

  console.info(
    `${new Date().toISOString()} Migrated ${totalTransactions} transactions`
  )
}

export const up = async () => {
  // We don't backfill non-prod envs
  if (process.env.ENV?.startsWith('prod')) {
    await migrateAllTenants((tenant) =>
      migrateTenant(
        tenant,
        0,
        new Date('2022-10-26').valueOf(),
        `2022.10.20T19.31.06.kill-thin-transaction-${tenant.id}`
      )
    )
  }
}

export const down = async () => {
  // skip
}
