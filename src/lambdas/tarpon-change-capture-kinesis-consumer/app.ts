import { KinesisStreamEvent } from 'aws-lambda'
import * as AWS from 'aws-sdk'
import {
  getMongoDbClient,
  USER_EVENTS_COLLECTION,
  USERS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { DashboardStatsRepository } from '@/lambdas/phytoplankton-internal-api-handlers/repository/dashboard-stats-repository'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { AlertPayload } from '@/@types/alert/alert-payload'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { logger } from '@/core/logger'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { TarponStreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'

const sqs = new AWS.SQS()

async function transactionHandler(
  tenantId: string,
  transaction: TransactionWithRulesResult | undefined
) {
  if (!transaction) {
    return
  }

  logger.info(`Processing transaction ${transaction.transactionId}`)
  const mongoDb = await getMongoDbClient()
  const transactionsRepo = new TransactionRepository(tenantId, {
    mongoDb,
  })
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })

  const transactionId = transaction.transactionId
  let currentStatus: RuleAction | null = null
  if (transactionId != null) {
    currentStatus =
      (await transactionsRepo.getTransactionCaseManagementById(transactionId))
        ?.status ?? null
  }
  const newStatus = (await transactionsRepo.addCaseToMongo(transaction)).status

  // TODO: this is not very efficient, because we recalculate all the
  // statistics for each transaction. Need to implement updating
  // a single record in DB using transaction date
  await dashboardStatsRepository.refreshStats()

  // New case slack alert: We only create alert for new transactions. Skip for existing transactions.
  if (!currentStatus && newStatus !== 'ALLOW') {
    const tenantRepository = new TenantRepository(tenantId, {
      mongoDb: await getMongoDbClient(),
    })
    if (await tenantRepository.getTenantMetadata('SLACK_WEBHOOK')) {
      logger.info(
        `Sending slack alert SQS message for transaction ${transactionId}`
      )
      await sqs
        .sendMessage({
          MessageBody: JSON.stringify({
            tenantId,
            transactionId: transactionId,
          } as AlertPayload),
          QueueUrl: process.env.SLACK_ALERT_QUEUE_URL as string,
        })
        .promise()
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

  logger.info(`Processing user ${user.userId}`)
  const db = (await getMongoDbClient()).db()
  const userCollection = db.collection<Business | User>(
    USERS_COLLECTION(tenantId)
  )
  await userCollection.replaceOne({ userId: user.userId }, user, {
    upsert: true,
  })
}

async function userEventHandler(
  tenantId: string,
  userEvent: ConsumerUserEvent | BusinessUserEvent | undefined
) {
  if (!userEvent) {
    return
  }

  logger.info(
    `Processing user event ${userEvent.eventId} (user: ${userEvent.userId})`
  )
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

  logger.info(
    `Processing transaction event: ${transactionEvent.eventId} (transaction: ${transactionEvent.transactionId})`
  )
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

const handler = new TarponStreamConsumerBuilder()
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

export const tarponChangeCaptureHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    try {
      await handler(event)
    } catch (err) {
      logger.error(err)
      return 'Internal error'
    }
  }
)
