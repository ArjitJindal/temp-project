import { KinesisStreamEvent } from 'aws-lambda'
import * as AWS from 'aws-sdk'
import { CaseCreationService } from '../console-api-case/services/case-creation-service'
import {
  getMongoDbClient,
  USER_EVENTS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
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
import { TarponStreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { updateLogMetadata } from '@/core/utils/context'
import { updateDynamicRiskScores } from '@/services/risk-scoring'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'

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
  if (await tenantHasFeature(tenantId, 'PULSE_ARS_CALCULATION')) {
    logger.info(`Calculating ARS & DRS`)
    await updateDynamicRiskScores(tenantId, dynamoDb, transaction)
    logger.info(`Calculation of ARS & DRS Completed`)
  }

  await dashboardStatsRepository.refreshTransactionStats(transaction.timestamp)

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
  await usersRepo.saveUserMongo(user)

  if (await tenantHasFeature(tenantId, 'PULSE_KRS_CALCULATION')) {
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

const handler = new TarponStreamConsumerBuilder(
  process.env.RETRY_KINESIS_STREAM_NAME as string
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
  .setTransactionEventHandler(
    (tenantId, oldTransactionEvent, newTransactionEvent) =>
      transactionEventHandler(tenantId, newTransactionEvent)
  )
  .build()
// NOTE: If we handle more entites, please add `localTarponChangeCaptureHandler(...)` to the corresponding
// place that updates the entity to make local work

export const tarponChangeMongodbHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    await handler(event)
  }
)
