import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { Db, MongoClient } from 'mongodb'
import * as AWS from 'aws-sdk'
import {
  TRANSACTION_PRIMARY_KEY_IDENTIFIER,
  USER_EVENT_KEY_IDENTIFIER,
  USER_PRIMARY_KEY_IDENTIFIER,
} from './constants'
import {
  connectToDB,
  USER_EVENTS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { unMarshallDynamoDBStream } from '@/utils/dynamodbStream'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { UserEventWithRulesResult } from '@/@types/openapi-public/UserEventWithRulesResult'
import { DashboardStatsRepository } from '@/lambdas/phytoplankton-internal-api-handlers/repository/dashboard-stats-repository'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { AlertPayload } from '@/@types/alert/alert-payload'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'

const sqs = new AWS.SQS()

async function transactionHandler(
  mongoDb: MongoClient,
  tenantId: string,
  transaction: TransactionWithRulesResult
) {
  const transactionsRepo = new TransactionRepository(tenantId, {
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

  // Alerting
  if (currentStatus !== newStatus && newStatus !== 'ALLOW') {
    const tenantRepository = new TenantRepository(tenantId, {
      mongoDb: await connectToDB(),
    })
    if (await tenantRepository.getTenantMetadata('SLACK_WEBHOOK')) {
      console.info(
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

async function userHandler(db: Db, tenantId: string, user: Business | User) {
  const userCollection = db.collection<Business | User>(
    USERS_COLLECTION(tenantId)
  )
  await userCollection.replaceOne({ userId: user.userId }, user, {
    upsert: true,
  })
}

async function userEventHandler(
  db: Db,
  tenantId: string,
  userEvent: UserEventWithRulesResult
) {
  const userEventCollection = db.collection<UserEventWithRulesResult>(
    USER_EVENTS_COLLECTION(tenantId)
  )
  const aggregatedStatus = TransactionRepository.getAggregatedRuleStatus(
    userEvent.executedRules.map((rule) => rule.ruleAction)
  )
  // TODO: Update user status: https://flagright.atlassian.net/browse/FDT-150
  await userEventCollection.replaceOne(
    { eventId: userEvent.eventId },
    {
      ...userEvent,
      status: aggregatedStatus,
    },
    {
      upsert: true,
    }
  )
}

export const tarponChangeCaptureHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    try {
      const client = await connectToDB()
      const db = client.db()
      for (const record of event.Records) {
        const payload: KinesisStreamRecordPayload = record.kinesis
        const message: string = Buffer.from(payload.data, 'base64').toString()
        const dynamoDBStreamObject = JSON.parse(message).dynamodb
        const tenantId =
          dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]
        const dashboardStatsRepository = new DashboardStatsRepository(
          tenantId,
          {
            mongoDb: client,
          }
        )
        if (
          dynamoDBStreamObject.Keys.PartitionKeyID.S.includes(
            TRANSACTION_PRIMARY_KEY_IDENTIFIER
          )
        ) {
          const transaction = handlePrimaryItem(
            message
          ) as TransactionWithRulesResult
          console.info(`Processing transaction ${transaction.transactionId}`)
          await transactionHandler(client, tenantId, transaction)
          /*
         todo: this is not very efficient, because we recalculate all the
           statistics for each transaction. Need to implement updating
           a single record in DB using transaction date
         */
          await dashboardStatsRepository.refreshStats()
        } else if (
          dynamoDBStreamObject.Keys.PartitionKeyID.S.includes(
            USER_PRIMARY_KEY_IDENTIFIER
          )
        ) {
          const user = handlePrimaryItem(message) as User
          console.info(`Processing user ${user.userId}`)
          await userHandler(db, tenantId, user)
        } else if (
          dynamoDBStreamObject.Keys.PartitionKeyID.S.includes(
            USER_EVENT_KEY_IDENTIFIER
          )
        ) {
          const userEvent = handlePrimaryItem(
            message
          ) as UserEventWithRulesResult
          console.info(
            `Processing user event ${userEvent.eventId} (user: ${userEvent.userId})`
          )
          await userEventHandler(db, tenantId, userEvent)
        }
      }
    } catch (err) {
      console.error(err)
      return 'Internal error'
    }
  }
)

const handlePrimaryItem = (message: string) => {
  const stremNewImage = JSON.parse(message).dynamodb.NewImage
  return unMarshallDynamoDBStream(JSON.stringify(stremNewImage))
}
