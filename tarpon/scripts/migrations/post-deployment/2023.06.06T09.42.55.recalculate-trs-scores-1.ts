import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { TRANSACTIONS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskScoringService } from '@/services/risk-scoring'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

// Pesawise: G7ZN1UYR9V
// ZIINA: FT398YYJMD
// Nexpay: 4PKTHPN204
// Nextpay: 85J6QJ28BY

const allowedTenants: Record<string, string[]> = {
  local: ['flagright'],
  dev: ['flagright'],
  sandbox: ['flagright'],
  prod: ['G7ZN1UYR9V', 'FT398YYJMD', '4PKTHPN204', '85J6QJ28BY', 'flagright'],
}

const BATCH_SIZE = 20 // Max limit for batchWriteItem is 25

const publishItems = async (
  dynamoDb: DynamoDBDocumentClient,
  putRequestItems: AWS.DynamoDB.DocumentClient.WriteRequest[]
) => {
  const batchWriteItemInput: AWS.DynamoDB.DocumentClient.BatchWriteItemInput = {
    RequestItems: {
      [StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME]: putRequestItems,
    },
  }

  await dynamoDb.send(new BatchWriteCommand(batchWriteItemInput))
}

async function migrateTenant(tenant: Tenant) {
  const env = process.env.ENV?.startsWith('prod')
    ? 'prod'
    : process.env.ENV || ''

  if (!allowedTenants[env]?.includes(tenant.id)) {
    console.log(`Skipping tenant ${tenant.id}, ${tenant.name}`)
    return
  }

  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const db = mongoDb.db()

  const transactionsCollectionName = TRANSACTIONS_COLLECTION(tenant.id)
  const transactionsCollection = db.collection<InternalTransaction>(
    transactionsCollectionName
  )

  const transactionsWithoutArsScore = await transactionsCollection
    .find({
      $or: [
        { arsScore: { $exists: false } },
        { 'arsScore.arsScore': { $exists: false } },
      ],
    })
    .sort({ timestamp: 1 })

  console.log(
    `Found ${await transactionsWithoutArsScore.count()} transactions without arsScore`
  )

  const riskRepository = new RiskRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskScoringService = new RiskScoringService(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskClassificationValues =
    await riskRepository.getRiskClassificationValues()

  const riskFactors = await riskRepository.getParameterRiskItems()

  const putRequestItems: AWS.DynamoDB.DocumentClient.WriteRequest[] = []

  for await (const transaction of transactionsWithoutArsScore) {
    const arsScore = await riskRepository.getArsScore(transaction.transactionId)

    if (arsScore) {
      await transactionsCollection.updateOne(
        { _id: transaction._id },
        { $set: { arsScore } }
      )
    } else {
      const { score, components } = await riskScoringService.calculateArsScore(
        transaction,
        riskClassificationValues,
        riskFactors || []
      )

      const newArsScoreItem: ArsScore = {
        arsScore: score,
        createdAt: Date.now(),
        originUserId: transaction.originUserId,
        destinationUserId: transaction.destinationUserId,
        transactionId: transaction.transactionId,
        components,
      }

      const primaryKey = DynamoDbKeys.ARS_VALUE_ITEM(
        tenant.id,
        transaction.transactionId,
        '1'
      )

      putRequestItems.push({
        PutRequest: {
          Item: {
            ...newArsScoreItem,
            ...primaryKey,
          },
        },
      })

      if (putRequestItems.length >= BATCH_SIZE) {
        await publishItems(dynamoDb, putRequestItems)
        putRequestItems.splice(0, putRequestItems.length) // Clear the array
        continue
      }

      await publishItems(dynamoDb, putRequestItems)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
