import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { APIGateway } from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { logger } from '@/core/logger'

import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import {
  AUDITLOG_COLLECTION,
  CASES_COLLECTION,
  getMongoDbClient,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { Case } from '@/@types/openapi-internal/Case'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { sendBatchJobCommand } from '@/services/batch-job'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { getFullTenantId } from '@/lambdas/jwt-authorizer/app'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const base62 = require('base-x')(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
)

export type ApiKeyGeneratorQueryStringParameters = {
  tenantId: string
  usagePlanId: string
  demoTenant: string
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
    const { tenantId, usagePlanId, demoTenant } =
      event.queryStringParameters as ApiKeyGeneratorQueryStringParameters
    const mongoClient = await getMongoDbClient()
    const isDemo = demoTenant === 'true' && process.env.ENV === 'sandbox'
    const fullTenantId = getFullTenantId(tenantId, isDemo)
    await createMongoDBCollections(mongoClient, fullTenantId)
    if (isDemo) {
      const dynamoDb = await getDynamoDbClient()
      const tenantRepository = new TenantRepository(fullTenantId, { dynamoDb })
      await tenantRepository.createOrUpdateTenantSettings({
        features: ['DEMO_MODE'],
      })
      const batchJob: DemoModeDataLoadBatchJob = {
        type: 'DEMO_MODE_DATA_LOAD',
        tenantId: fullTenantId,
        awsCredentials: getCredentialsFromEvent(event),
      }
      await sendBatchJobCommand(fullTenantId, batchJob)
    }
    return createNewApiKeyForTenant(fullTenantId, usagePlanId)
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
    await transactionCollection.createIndex({
      transactionState: 1,
    })
    await transactionCollection.createIndex({
      'tags.key': 1,
    })
    await transactionCollection.createIndex({
      'hitRules.ruleAction': 1,
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
    await usersCollection.createIndex({
      'legalEntity.companyGeneralDetails.businessIndustry': 1,
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
    await casesCollection.createIndex({
      caseStatus: 1,
      caseType: 1,
      createdTimestamp: 1,
    })
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
    await casesCollection.createIndex({
      'caseTransactions.timestamp': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.originAmountDetails.transactionAmount': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.destinationAmountDetails.transactionAmount': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.originAmountDetails.country': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.destinationAmountDetails.country': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.destination.legalEntity.companyGeneralDetails.businessIndustry': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.origin.legalEntity.companyGeneralDetails.businessIndustry': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.originUserDrsScore': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.destinationUserDrsScore': 1,
    })

    try {
      await db.createCollection(AUDITLOG_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const auditlogCollection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(tenantId)
    )
    await auditlogCollection.createIndex({ auditlogId: 1 })
    await auditlogCollection.createIndex({ timestamp: -1 })
    await auditlogCollection.createIndex({ type: 1, action: 1 })
  } catch (e) {
    logger.error(`Error in creating MongoDB collections: ${e}`)
  }
}
