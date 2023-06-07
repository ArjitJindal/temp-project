import { StackConstants } from '@lib/constants'
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import { USERS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { RiskScoringService } from '@/services/risk-scoring'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

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
  const batchWriteParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput = {
    RequestItems: {
      [StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME]: putRequestItems,
    },
  }

  await dynamoDb.send(new BatchWriteCommand(batchWriteParams))
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

  const usersCollectionName = USERS_COLLECTION(tenant.id)
  const usersCollection = db.collection<InternalUser>(usersCollectionName)

  const usersWithoutKrsScore = await usersCollection.find()

  console.log(`Found ${await usersWithoutKrsScore.count()} users`)

  const riskRepository = new RiskRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskScoringService = new RiskScoringService(tenant.id, {
    mongoDb,
    dynamoDb,
  })

  const riskFactors = await riskRepository.getParameterRiskItems()
  const riskClassificationValues =
    await riskRepository.getRiskClassificationValues()

  const putRequestItems: AWS.DynamoDB.DocumentClient.WriteRequest[] = []

  for await (const user of usersWithoutKrsScore) {
    const { score, components } = await riskScoringService.calculateKrsScore(
      user,
      riskClassificationValues,
      riskFactors || []
    )

    const newKrsScoreItem: KrsScore = {
      krsScore: score,
      createdAt: Date.now(),
      userId: user.userId,
      components,
    }

    const primaryKey = DynamoDbKeys.KRS_VALUE_ITEM(tenant.id, user.userId, '1')

    putRequestItems.push({
      PutRequest: {
        Item: {
          ...newKrsScoreItem,
          ...primaryKey,
        },
      },
    })

    if (putRequestItems.length >= BATCH_SIZE) {
      await publishItems(dynamoDb, putRequestItems)
      putRequestItems.splice(0, putRequestItems.length)
      continue
    }
    await publishItems(dynamoDb, putRequestItems)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
