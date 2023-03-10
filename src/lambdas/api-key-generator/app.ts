import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
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
  SIMULATION_TASK_COLLECTION,
  SIMULATION_RESULT_COLLECTION,
  KRS_SCORES_COLLECTION,
  DRS_SCORES_COLLECTION,
  WEBHOOK_COLLECTION,
  ARS_SCORES_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { Case } from '@/@types/openapi-internal/Case'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

import { getDynamoDbClient } from '@/utils/dynamodb'
import { sendBatchJobCommand } from '@/services/batch-job'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { DemoModeDataLoadBatchJob } from '@/@types/batch-job'
import { getFullTenantId } from '@/lambdas/jwt-authorizer/app'
import { createNewApiKeyForTenant } from '@/services/api-key'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'

export type ApiKeyGeneratorQueryStringParameters = {
  tenantId: string
  usagePlanId: string
  demoTenant: string
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
    await transactionCollection.createIndex({
      destinationUserId: 1,
      timestamp: -1,
    })
    await transactionCollection.createIndex({ originUserId: 1, timestamp: -1 })
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
      createdTimestamp: 1,
    })
    await casesCollection.createIndex({ 'caseUsers.origin.userId': 1 })
    await casesCollection.createIndex({ 'caseUsers.destination.userId': 1 })
    await casesCollection.createIndex({
      'caseUsers.origin.userId': 1,
    })
    await casesCollection.createIndex({
      'caseUsers.destination.userId': 1,
    })
    await casesCollection.createIndex({
      'caseTransactions.transactionId': 1,
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
    await casesCollection.createIndex({
      'caseTransactions.arsScore': 1,
    })
    await casesCollection.createIndex({
      'assignments.assigneeUserId': 1,
    })
    await casesCollection.createIndex({
      'statusChanges.timestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts.statusChanges.timestamp': 1,
    })
    await casesCollection.createIndex({
      'lastStatusChange.timestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts.lastStatusChange.timestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts.alertId': 1,
    })
    await casesCollection.createIndex({
      'alerts.alertStatus': 1,
    })
    await casesCollection.createIndex({
      'alerts.alertStatus': 1,
    })
    await casesCollection.createIndex({
      'alerts.assignments.assigneeUserId': 1,
    })
    await casesCollection.createIndex({
      'alerts.priority': 1,
    })
    await casesCollection.createIndex({
      'alerts.createdTimestamp': 1,
    })
    await casesCollection.createIndex({
      'alerts.numberOfTransactionsHit': 1,
    })
    await transactionCollection.createIndex({
      arsScore: 1,
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

    try {
      await db.createCollection(SIMULATION_TASK_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const simulationTaskCollection = db.collection(
      SIMULATION_TASK_COLLECTION(tenantId)
    )
    await simulationTaskCollection.createIndex({
      type: 1,
      createdAt: -1,
    })

    try {
      await db.createCollection(SIMULATION_RESULT_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const simulationResultCollection = db.collection(
      SIMULATION_RESULT_COLLECTION(tenantId)
    )
    await simulationResultCollection.createIndex({
      taskId: 1,
    })

    try {
      await db.createCollection(KRS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const krsScoresCollection = db.collection(KRS_SCORES_COLLECTION(tenantId))
    await krsScoresCollection.createIndex({
      userId: 1,
    })
    try {
      await db.createCollection(ARS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const arsScoresCollection = db.collection(ARS_SCORES_COLLECTION(tenantId))
    await arsScoresCollection.createIndex({
      transactionId: 1,
    })
    try {
      await db.createCollection(DRS_SCORES_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const drsScoresCollection = db.collection(DRS_SCORES_COLLECTION(tenantId))
    await drsScoresCollection.createIndex({
      userId: 1,
    })

    try {
      await db.createCollection(WEBHOOK_COLLECTION(tenantId))
    } catch (e) {
      // ignore already exists
    }
    const webhookCollection = db.collection<WebhookConfiguration>(
      WEBHOOK_COLLECTION(tenantId)
    )
    await webhookCollection.createIndex({
      events: 1,
    })
  } catch (e) {
    logger.error(`Error in creating MongoDB collections: ${e}`)
  }
}
