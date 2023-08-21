import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { SQS, SendMessageCommand } from '@aws-sdk/client-sqs'
import { flatten, pick } from 'lodash'
import { CaseCreationService } from '../console-api-case/services/case-creation-service'
import { CasesAlertsAuditLogService } from '../console-api-case/services/case-alerts-audit-log-service'
import {
  getMongoDbClient,
  USER_EVENTS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { NewCaseAlertPayload } from '@/@types/alert/alert-payload'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { logger } from '@/core/logger'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { StreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { cleanUpDynamoDbResources, getDynamoDbClient } from '@/utils/dynamodb'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { updateLogMetadata } from '@/core/utils/context'
import { RiskScoringService } from '@/services/risk-scoring'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { DeviceMetric } from '@/@types/openapi-public-device-data/DeviceMetric'
import { MetricsRepository } from '@/services/rules-engine/repositories/metrics'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { InternalConsumerUserEvent } from '@/@types/openapi-internal/InternalConsumerUserEvent'
import { InternalBusinessUserEvent } from '@/@types/openapi-internal/InternalBusinessUserEvent'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'

const sqs = new SQS({
  region: process.env.AWS_REGION,
})

async function handleNewCases(
  tenantId: string,
  timestampBeforeCasesCreation: number,
  cases: Case[]
) {
  const mongoDb = await getMongoDbClient()
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })

  // Update dashboard stats
  await Promise.all(
    cases.map((c) =>
      dashboardStatsRepository.refreshCaseStats({
        startTimestamp: c.createdTimestamp,
      })
    )
  )
  const tenantRepository = new TenantRepository(tenantId, {
    mongoDb: await getMongoDbClient(),
  })

  const newAlerts = flatten(cases.map((c) => c.alerts)).filter(
    (alert) =>
      alert &&
      alert.createdTimestamp &&
      alert.createdTimestamp >= timestampBeforeCasesCreation
  )
  const newCases = cases.filter(
    (c) =>
      c.createdTimestamp && c.createdTimestamp >= timestampBeforeCasesCreation
  )
  if (await tenantRepository.getTenantMetadata('SLACK_WEBHOOK')) {
    for (const caseItem of newCases) {
      logger.info(`Sending slack alert SQS message for case ${caseItem.caseId}`)
      const payload: NewCaseAlertPayload = {
        kind: 'NEW_CASE',
        tenantId,
        caseId: caseItem.caseId as string,
      }
      const sqsSendMessageCommand = new SendMessageCommand({
        MessageBody: JSON.stringify(payload),
        QueueUrl: process.env.SLACK_ALERT_QUEUE_URL as string,
      })

      await sqs.send(sqsSendMessageCommand)
    }
  }
  const dynamoDb = await getDynamoDbClient()
  const casesAlertsAuditLogService = new CasesAlertsAuditLogService(tenantId, {
    mongoDb,
    dynamoDb,
  })
  const propertiesToPickForCase = [
    'caseId',
    'caseType',
    'createdBy',
    'createdTimestamp',
    'availableAfterTimestamp',
  ]
  await Promise.all(
    newCases.map(async (caseItem) => {
      await casesAlertsAuditLogService.handleAuditLogForNewCase(
        pick(caseItem, propertiesToPickForCase),
        'ACTIVITY_LOG'
      )
    })
  )
  const propertiesToPickForAlert = [
    'alertId',
    'parentAlertId',
    'createdTimestamp',
    'availableAfterTimestamp',
    'latestTransactionArrivalTimestamp',
    'caseId',
    'alertStatus',
    'ruleInstanceId',
    'ruleName',
    'ruleDescription',
    'ruleId',
    'ruleAction',
    'ruleNature',
    'numberOfTransactionsHit',
    'priority',
    'statusChanges',
    'lastStatusChange',
    'updatedAt',
  ]
  await Promise.all(
    newAlerts.map(async (alert) => {
      await casesAlertsAuditLogService.handleAuditLogForNewAlert(
        pick(alert, propertiesToPickForAlert),
        'ACTIVITY_LOG'
      )
    })
  )
}

async function transactionHandler(
  tenantId: string,
  transaction: TransactionWithRulesResult | undefined
) {
  if (!transaction || !transaction.transactionId) {
    return
  }
  updateLogMetadata({ transactionId: transaction.transactionId })
  logger.info(`Processing Transaction`)

  const mongoDb = await getMongoDbClient()

  const dynamoDb = await getDynamoDbClient()
  const transactionsRepo = new MongoDbTransactionRepository(tenantId, mongoDb)
  const casesRepo = new CaseRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })
  const ruleInstancesRepo = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const usersRepo = new UserRepository(tenantId, { mongoDb, dynamoDb })

  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb,
  })
  const tenantSettings = await tenantRepository.getTenantSettings()
  const caseCreationService = new CaseCreationService(
    casesRepo,
    usersRepo,
    ruleInstancesRepo,
    transactionsRepo,
    tenantSettings
  )
  const riskScoringService = new RiskScoringService(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const transactionInMongo = await transactionsRepo.addTransactionToMongo(
    transaction
  )

  logger.info(`Starting Case Creation`)
  const timestampBeforeCasesCreation = Date.now()
  const cases = await caseCreationService.handleTransaction(transactionInMongo)
  logger.info(`Case Creation Completed`)
  if (await tenantHasFeature(tenantId, 'PULSE')) {
    logger.info(`Calculating ARS & DRS`)

    const { originDrsScore, destinationDrsScore } =
      await riskScoringService.updateDynamicRiskScores(transaction)

    logger.info(`Calculation of ARS & DRS Completed`)

    await casesRepo.updateDynamicRiskScores(
      transaction.transactionId,
      originDrsScore,
      destinationDrsScore
    )

    logger.info(`DRS Updated in Cases`)
  }

  await dashboardStatsRepository.refreshTransactionStats({
    startTimestamp: transaction.timestamp,
  })
  await handleNewCases(tenantId, timestampBeforeCasesCreation, cases)

  cleanUpDynamoDbResources()
}

async function userHandler(
  tenantId: string,
  user: BusinessWithRulesResult | UserWithRulesResult | undefined
) {
  if (!user || !user.userId) {
    return
  }
  updateLogMetadata({ userId: user.userId })
  logger.info(`Processing User`)

  let internalUser = user as InternalUser
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const transactionsRepo = new MongoDbTransactionRepository(tenantId, mongoDb)
  const casesRepo = new CaseRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })
  const ruleInstancesRepo = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const usersRepo = new UserRepository(tenantId, { mongoDb, dynamoDb })

  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb,
  })

  const tenantSettings = await tenantRepository.getTenantSettings()

  const caseCreationService = new CaseCreationService(
    casesRepo,
    usersRepo,
    ruleInstancesRepo,
    transactionsRepo,
    tenantSettings
  )

  if (await tenantHasFeature(tenantId, 'PULSE')) {
    const dynamoDb = await getDynamoDbClient()
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })

    const krsScore = await riskRepository.getKrsScore(internalUser.userId)
    const drsScore = await riskRepository.getDrsScore(internalUser.userId)

    if (!krsScore && !drsScore) {
      logger.error(
        new Error(
          `KRS and DRS scores are not available for user ${internalUser.userId} in tenant ${tenantId}`
        )
      )
    }

    internalUser = {
      ...internalUser,
      ...(krsScore && { krsScore }),
      ...(drsScore && { drsScore }),
    }

    if (drsScore) {
      await usersRepo.updateDrsScoreOfUserMongo(internalUser.userId, drsScore)
    }
  }

  const existingUser = await usersRepo.getUserById(internalUser.userId)

  internalUser.createdAt = existingUser?.createdAt ?? Date.now()

  const savedUser = await usersRepo.saveUserMongo(internalUser)

  if (await tenantHasFeature(tenantId, 'PULSE')) {
    logger.info(`Refreshing DRS User distribution stats`)
    await dashboardStatsRepository.refreshUserStats()
    logger.info(`Refreshing DRS User distribution stats - completed`)
  }
  const timestampBeforeCasesCreation = Date.now()
  const cases = await caseCreationService.handleUser(savedUser)
  await handleNewCases(tenantId, timestampBeforeCasesCreation, cases)
  await casesRepo.updateUsersInCases(internalUser)

  cleanUpDynamoDbResources()
}

async function userEventHandler(
  tenantId: string,
  userEvent: ConsumerUserEvent | BusinessUserEvent | undefined
) {
  if (!userEvent || !userEvent.eventId) {
    return
  }
  updateLogMetadata({
    userId: userEvent.userId,
    userEventId: userEvent.eventId,
  })
  logger.info(`Processing User Event`)

  const db = (await getMongoDbClient()).db()
  const userEventCollection = db.collection<
    InternalConsumerUserEvent | InternalBusinessUserEvent
  >(USER_EVENTS_COLLECTION(tenantId))

  // TODO: Update user status: https://flagright.atlassian.net/browse/FDT-150
  await userEventCollection.replaceOne(
    { eventId: userEvent.eventId },
    { ...userEvent, createdAt: Date.now() },
    { upsert: true }
  )
}

async function deviceDataMetricsHandler(
  tenantId: string,
  deviceMetrics: DeviceMetric | undefined
) {
  if (!deviceMetrics || !deviceMetrics.userId) {
    return
  }
  updateLogMetadata({
    userId: deviceMetrics.userId,
  })
  logger.info(`Processing Device Metric`)

  const mongoDb = await getMongoDbClient()
  const metricsRepository = new MetricsRepository(tenantId, {
    mongoDb: mongoDb,
  })
  await metricsRepository.saveMetricMongo(deviceMetrics)
}

async function transactionEventHandler(
  tenantId: string,
  transactionEvent: TransactionEvent | undefined
) {
  if (!transactionEvent || !transactionEvent.eventId) {
    return
  }
  updateLogMetadata({
    transactionId: transactionEvent.transactionId,
    eventId: transactionEvent.eventId,
  })
  logger.info(`Processing Transaction Event`)

  const db = (await getMongoDbClient()).db()

  const transactionEventCollection = db.collection<InternalTransactionEvent>(
    TRANSACTION_EVENTS_COLLECTION(tenantId)
  )

  await transactionEventCollection.replaceOne(
    { eventId: transactionEvent.eventId },
    { ...transactionEvent, createdAt: Date.now() },
    { upsert: true }
  )
}

const tarponBuilder = new StreamConsumerBuilder(
  path.basename(__dirname) + '-tarpon',
  process.env.TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL!
)
  .setTransactionHandler((tenantId, oldTransaction, newTransaction) =>
    transactionHandler(tenantId, newTransaction)
  )
  .setUserHandler((tenantId, oldUser, newUser) =>
    userHandler(tenantId, newUser)
  )
  .setUserEventHandler((tenantId, oldUserEvent, newUserEvent) =>
    userEventHandler(tenantId, newUserEvent)
  )
  .setDeviceDataMetricsHandler((tenantId, oldUserEvent, newUserEvent) =>
    deviceDataMetricsHandler(tenantId, newUserEvent)
  )
  .setTransactionEventHandler(
    (tenantId, oldTransactionEvent, newTransactionEvent) =>
      transactionEventHandler(tenantId, newTransactionEvent)
  )

// NOTE: If we handle more entites, please add `localDynamoDbChangeCaptureHandler(...)` to the corresponding
// place that updates the entity to make local work

const tarponKinesisHandler = tarponBuilder.buildKinesisStreamHandler()
const tarponSqsRetryHandler = tarponBuilder.buildSqsRetryHandler()

export const tarponChangeMongoDbHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    await tarponKinesisHandler(event)
  }
)

export const tarponChangeMongoDbRetryHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    await tarponSqsRetryHandler(event)
  }
)
