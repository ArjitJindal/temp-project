import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import * as AWS from 'aws-sdk'
import * as Sentry from '@sentry/node'
import { CaseCreationService } from '../console-api-case/services/case-creation-service'
import {
  getMongoDbClient,
  USER_EVENTS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  DEVICE_DATA_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { NewCaseAlertPayload } from '@/@types/alert/alert-payload'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { logger } from '@/core/logger'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { StreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { updateLogMetadata } from '@/core/utils/context'
import { RiskScoringService } from '@/services/risk-scoring'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { DeviceMetric } from '@/@types/openapi-public-device-data/DeviceMetric'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

const sqs = new AWS.SQS()

async function transactionHandler(
  tenantId: string,
  transaction: TransactionWithRulesResult | undefined
) {
  if (!transaction) {
    return
  }
  updateLogMetadata({ transactionId: transaction.transactionId })
  logger.info(`Processing Transaction`)

  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const transactionsRepo = new TransactionRepository(tenantId, {
    mongoDb,
  })
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
  const caseCreationService = new CaseCreationService(
    casesRepo,
    usersRepo,
    ruleInstancesRepo,
    transactionsRepo
  )
  const riskScoringService = new RiskScoringService(tenantId, {
    dynamoDb,
    mongoDb,
  })

  const transactionId = transaction.transactionId
  let currentStatus: RuleAction | null = null
  if (transactionId != null) {
    currentStatus =
      (await transactionsRepo.getTransactionCaseManagementById(transactionId))
        ?.status ?? null
  }
  const transactionInMongo = await transactionsRepo.addTransactionToMongo(
    transaction
  )
  const newStatus = transactionInMongo.status
  logger.info(`Starting Case Creation`)
  const cases = await caseCreationService.handleTransaction(transaction)
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

  // Update dashboard stats
  await Promise.all([
    dashboardStatsRepository.refreshTransactionStats(transaction.timestamp),
    ...cases.map((c) =>
      dashboardStatsRepository.refreshCaseStats(c.createdTimestamp)
    ),
  ])

  // New case slack alert: We only create alert for new transactions. Skip for existing transactions.
  if (!currentStatus && newStatus !== 'ALLOW' && cases.length > 0) {
    const tenantRepository = new TenantRepository(tenantId, {
      mongoDb: await getMongoDbClient(),
    })
    if (await tenantRepository.getTenantMetadata('SLACK_WEBHOOK')) {
      for (const caseItem of cases) {
        logger.info(
          `Sending slack alert SQS message for transaction ${transactionId}`
        )
        const payload: NewCaseAlertPayload = {
          kind: 'NEW_CASE',
          tenantId,
          caseId: caseItem.caseId as string,
        }
        await sqs
          .sendMessage({
            MessageBody: JSON.stringify(payload),
            QueueUrl: process.env.SLACK_ALERT_QUEUE_URL as string,
          })
          .promise()
      }
    }
  }
}

async function userHandler(
  tenantId: string,
  user: Business | User | undefined
) {
  if (!user) {
    return
  }

  const mongoDb = await getMongoDbClient()
  updateLogMetadata({ userId: user.userId })
  logger.info(`Processing User`)
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })
  const usersRepo = new UserRepository(tenantId, { mongoDb })

  if (await tenantHasFeature(tenantId, 'PULSE')) {
    const dynamoDb = await getDynamoDbClient()
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })

    const krsScore = await riskRepository.getKrsScore(user.userId)
    const drsScore = await riskRepository.getDrsScore(user.userId)

    if (!krsScore && !drsScore) {
      if (
        process.env.NODE_ENV !== 'development' &&
        process.env.NODE_ENV !== 'test' &&
        process.env.ENV !== 'local'
      ) {
        Sentry.captureException(
          new Error(
            `KRS and DRS scores are not available for user ${user.userId} in tenant ${tenantId}`
          )
        )
      }
    }

    user = {
      ...user,
      ...(krsScore && { krsScore }),
      ...(drsScore && { drsScore }),
    }
  }

  await usersRepo.saveUserMongo(user)

  if (await tenantHasFeature(tenantId, 'PULSE')) {
    logger.info(`Refreshing DRS User distribution stats`)
    await dashboardStatsRepository.refreshUserStats()
    logger.info(`Refreshing DRS User distribution stats - completed`)
  }
  const casesRepo = new CaseRepository(tenantId, {
    mongoDb,
  })
  await casesRepo.updateUsersInCases(user)
}

async function userEventHandler(
  tenantId: string,
  userEvent: ConsumerUserEvent | BusinessUserEvent | undefined
) {
  if (!userEvent) {
    return
  }
  updateLogMetadata({
    userId: userEvent.userId,
    userEventId: userEvent.eventId,
  })
  logger.info(`Processing User Event`)

  const db = (await getMongoDbClient()).db()
  const userEventCollection = db.collection<
    ConsumerUserEvent | BusinessUserEvent
  >(USER_EVENTS_COLLECTION(tenantId))

  // TODO: Update user status: https://flagright.atlassian.net/browse/FDT-150
  await userEventCollection.replaceOne(
    { eventId: userEvent.eventId },
    {
      ...userEvent,
    },
    {
      upsert: true,
    }
  )
}

async function deviceDataMetricsHandler(
  tenantId: string,
  deviceMetrics: DeviceMetric | undefined
) {
  if (!deviceMetrics) {
    return
  }
  updateLogMetadata({
    userId: deviceMetrics.userId,
  })
  logger.info(`Processing Device Metric`)

  const db = (await getMongoDbClient()).db()
  const deviceMetricsDataCollection = db.collection<
    ConsumerUserEvent | BusinessUserEvent
  >(DEVICE_DATA_COLLECTION(tenantId))

  await deviceMetricsDataCollection.replaceOne(
    { metricId: deviceMetrics.metricId },
    {
      ...deviceMetrics,
    },
    {
      upsert: true,
    }
  )
}

async function transactionEventHandler(
  tenantId: string,
  transactionEvent: TransactionEvent | undefined
) {
  if (!transactionEvent) {
    return
  }
  updateLogMetadata({
    transactionId: transactionEvent.transactionId,
    eventId: transactionEvent.eventId,
  })
  logger.info(`Processing Transaction Event`)

  const db = (await getMongoDbClient()).db()
  const transactionEventCollection = db.collection<TransactionEvent>(
    TRANSACTION_EVENTS_COLLECTION(tenantId)
  )
  await transactionEventCollection.replaceOne(
    { eventId: transactionEvent.eventId },
    {
      ...transactionEvent,
    },
    {
      upsert: true,
    }
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
