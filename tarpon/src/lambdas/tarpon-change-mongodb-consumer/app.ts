import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { omit } from 'lodash'
import { StackConstants } from '@lib/constants'
import { sendTransactionEvent } from '../transaction-events-consumer/app'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  TRANSACTION_EVENTS_COLLECTION,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { logger } from '@/core/logger'
import { StreamConsumerBuilder } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { updateLogMetadata } from '@/core/utils/context'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'
import { isDemoTenant } from '@/utils/tenant'
import { DYNAMO_KEYS } from '@/core/seed/dynamodb'
import { insertToClickhouse } from '@/utils/clickhouse-utils'
import { UserWithRulesResult } from '@/@types/openapi-public/UserWithRulesResult'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { sendUserEvent } from '@/lambdas/user-events-consumer/app'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { InternalConsumerUserEvent } from '@/@types/openapi-internal/InternalConsumerUserEvent'
import { InternalBusinessUserEvent } from '@/@types/openapi-internal/InternalBusinessUserEvent'

async function transactionHandler(
  tenantId: string,
  transaction: TransactionWithRulesResult | undefined
) {
  if (!transaction || !transaction.transactionId || isDemoTenant(tenantId)) {
    return
  }
  await sendTransactionEvent({
    tenantId,
    transaction,
  })
}

async function userHandler(
  tenantId: string,
  oldUser: BusinessWithRulesResult | UserWithRulesResult | undefined,
  newUser: BusinessWithRulesResult | UserWithRulesResult | undefined
) {
  if (!newUser || !newUser.userId) {
    return
  }
  await sendUserEvent({
    tenantId,
    oldUser,
    newUser,
  })
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
  await Promise.all([
    userEventCollection.replaceOne(
      { eventId: userEvent.eventId },
      {
        ...(omit(userEvent, DYNAMO_KEYS) as
          | InternalConsumerUserEvent
          | InternalBusinessUserEvent),
        createdAt: Date.now(),
      },
      { upsert: true }
    ),
    insertToClickhouse(USER_EVENTS_COLLECTION(tenantId), userEvent, tenantId),
  ])
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

  await Promise.all([
    transactionEventCollection.replaceOne(
      { eventId: transactionEvent.eventId },
      {
        ...(omit(transactionEvent, DYNAMO_KEYS) as InternalTransactionEvent),
        createdAt: Date.now(),
      },
      { upsert: true }
    ),
    insertToClickhouse(
      TRANSACTION_EVENTS_COLLECTION(tenantId),
      transactionEvent,
      tenantId
    ),
  ])
}

const tarponBuilder = new StreamConsumerBuilder(
  path.basename(__dirname) + '-tarpon',
  process.env.TARPON_CHANGE_CAPTURE_RETRY_QUEUE_URL ?? '',
  StackConstants.TARPON_DYNAMODB_TABLE_NAME
)
  .setTransactionHandler((tenantId, oldTransaction, newTransaction) =>
    transactionHandler(tenantId, newTransaction)
  )
  .setUserHandler((tenantId, oldUser, newUser) =>
    userHandler(tenantId, oldUser, newUser)
  )
  .setUserEventHandler((tenantId, oldUserEvent, newUserEvent) =>
    userEventHandler(tenantId, newUserEvent)
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
