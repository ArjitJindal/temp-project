import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { APIGateway } from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { logger } from '@/core/logger'

import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  CASES_COLLECTION,
  getMongoDbClient,
  TRANSACTIONS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { Case } from '@/@types/openapi-internal/Case'

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

export const apiKeyGeneratorHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
    >
  ) => {
    const { tenantId, usagePlanId } =
      event.queryStringParameters as ApiKeyGeneratorQueryStringParameters
    await createMongoDBCollections(await getMongoDbClient(), tenantId)
    return createNewApiKeyForTenant(tenantId, usagePlanId)
  }
)

export const createMongoDBCollections = async (
  mongoClient: MongoClient,
  tenantId: string
) => {
  const db = mongoClient.db()
  try {
    try {
      await db.createCollection(TRANSACTIONS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const transactionCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    await transactionCollection.createIndex({
      timestamp: -1,
    })
    await transactionCollection.createIndex({
      caseStatus: 1,
      type: 1,
      status: 1,
      timestamp: -1,
    })
    await transactionCollection.createIndex({ transactionId: 1 })
    await transactionCollection.createIndex({ destinationUserId: 1 })
    await transactionCollection.createIndex({ originUserId: 1 })
    await transactionCollection.createIndex({
      'destinationAmountDetails.transactionCurrency': 1,
    })
    await transactionCollection.createIndex({
      'originAmountDetails.transactionCurrency': 1,
    })
    await transactionCollection.createIndex({
      'destinationPaymentDetails.method': 1,
    })
    await transactionCollection.createIndex({
      'originPaymentDetails.method': 1,
    })

    try {
      await db.createCollection(USERS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const usersCollection = db.collection(USERS_COLLECTION(tenantId))
    await usersCollection.createIndex({
      createdTimestamp: -1,
    })
    await usersCollection.createIndex({
      userId: 1,
    })
    await usersCollection.createIndex({
      'userDetails.name.firstName': 1,
    })
    await usersCollection.createIndex({
      'userDetails.name.middleName': 1,
    })
    await usersCollection.createIndex({
      'userDetails.name.lastName': 1,
    })
    await usersCollection.createIndex({
      'legalEntity.companyGeneralDetails.legalName': 1,
    })

    try {
      await db.createCollection(TRANSACTION_EVENTS_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const transactionEventsCollection = db.collection(
      TRANSACTION_EVENTS_COLLECTION(tenantId)
    )
    await transactionEventsCollection.createIndex({
      transactionId: 1,
      transactionState: 1,
      timestamp: -1,
    })
    await transactionEventsCollection.createIndex({
      eventId: 1,
    })
    try {
      await db.createCollection(CASES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    await casesCollection.createIndex({ caseId: 1 })
    await casesCollection.createIndex({ 'caseUsers.origin.userId': 1 })
    await casesCollection.createIndex({ 'caseUsers.destination.userId': 1 })
    await casesCollection.createIndex({
      caseType: 1,
      'caseUsers.origin.userId': 1,
    })
    await casesCollection.createIndex({
      caseType: 1,
      'caseUsers.destination.userId': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.transactionId': 1,
      caseType: 1,
    })
    await casesCollection.createIndex({ 'caseTransactions.status': 1 })
    await casesCollection.createIndex({
      'caseTransactions.destinationAmountDetails.transactionCurrency': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.originAmountDetails.transactionCurrency': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.destinationPaymentDetails.method': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.originPaymentDetails.method': 1,
    })
  } catch (e) {
    logger.error(`Error in creating MongoDB collections: ${e}`)
  }
}
