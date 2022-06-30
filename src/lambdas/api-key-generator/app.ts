import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { APIGateway } from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'

import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  connectToDB,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'

let client: MongoClient

// eslint-disable-next-line @typescript-eslint/no-var-requires
const base62 = require('base-x')(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
)

export type ApiKeyGeneratorQueryStringParameters = {
  tenantId: string
  usagePlanId: string
}

function createUuid() {
  return uuidv4().replace(/-/g, '')
}

function createNewApiKey(tenantId: string) {
  return base62.encode(
    Buffer.from(`${tenantId}.${createUuid()}${createUuid()}`)
  )
}

async function createNewApiKeyForTenant(
  tenantId: string,
  usagePlanId: string
): Promise<string> {
  // TODO: Verify tenantId exists (in DB and Usage Plan)
  const newApiKey = createNewApiKey(tenantId)
  const apiGateway = new APIGateway()
  const apiKeyResult = await apiGateway
    .createApiKey({
      enabled: true,
      name: tenantId, // TODO: concat with user ID
      value: newApiKey,
    })
    .promise()
  await apiGateway
    .createUsagePlanKey({
      usagePlanId,
      keyId: apiKeyResult.id as string,
      keyType: 'API_KEY',
    })
    .promise()
  return newApiKey
}

export const createMongoDBCollections = async (tenantId: string) => {
  client = await connectToDB()
  const db = client.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
  try {
    await db.createCollection(TRANSACTIONS_COLLECTION(tenantId))
    const transactionCollection = db.collection(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    await transactionCollection.createIndex({
      timestamp: 1,
      type: 1,
      status: 1,
    })
    await transactionCollection.createIndex({ transactionId: 1 })
    await transactionCollection.createIndex({ destinationUserId: 1 })
    await transactionCollection.createIndex({ originUserId: 1 })

    await db.createCollection(USERS_COLLECTION(tenantId))
    const usersCollection = db.collection(USERS_COLLECTION(tenantId))
    await usersCollection.createIndex({
      createdTimestamp: 1,
    })
    await usersCollection.createIndex({
      userId: 1,
    })
  } catch (e) {
    console.log(`Error in creating MongoDB collections: ${e}`)
  }
}
export const apiKeyGeneratorHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { tenantId, usagePlanId } =
      event.queryStringParameters as ApiKeyGeneratorQueryStringParameters
    await createMongoDBCollections(tenantId)
    return createNewApiKeyForTenant(tenantId, usagePlanId)
  }
)
