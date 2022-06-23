import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { Db } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import {
  TRANSACTION_PRIMARY_KEY_IDENTIFIER,
  USER_EVENT_KEY_IDENTIFIER,
  USER_PRIMARY_KEY_IDENTIFIER,
} from './constants'
import {
  connectToDB,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { unMarshallDynamoDBStream } from '@/utils/dynamodbStream'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { UserEventWithRulesResult } from '@/@types/openapi-public/UserEventWithRulesResult'
import { DashboardStatsRepository } from '@/lambdas/phytoplankton-internal-api-handlers/repository/dashboard-stats-repository'

function getAggregatedRuleStatus(
  ruleActions: ReadonlyArray<RuleAction>
): RuleAction {
  const rulesPrecedences: RuleAction[] = ['BLOCK', 'FLAG', 'WHITELIST', 'ALLOW']
  return ruleActions.reduce((prev, curr) => {
    if (rulesPrecedences.indexOf(curr) < rulesPrecedences.indexOf(prev)) {
      return curr
    } else {
      return prev
    }
  }, 'ALLOW')
}

async function transactionHandler(
  db: Db,
  tenantId: string,
  transaction: TransactionWithRulesResult
) {
  const transactionsCollection = db.collection<TransactionCaseManagement>(
    TRANSACTIONS_COLLECTION(tenantId)
  )
  await transactionsCollection.replaceOne(
    { transactionId: transaction.transactionId },
    {
      ...transaction,
      status: getAggregatedRuleStatus(
        transaction.executedRules
          .filter((rule) => rule.ruleHit)
          .map((rule) => rule.ruleAction)
      ),
    },
    { upsert: true }
  )
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
  const aggregatedStatus = getAggregatedRuleStatus(
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

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  try {
    const client = await connectToDB()
    const db = client.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    for (const record of event.Records) {
      const payload: KinesisStreamRecordPayload = record.kinesis
      const message: string = Buffer.from(payload.data, 'base64').toString()
      const dynamoDBStreamObject = JSON.parse(message).dynamodb
      const tenantId = dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]
      const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
        mongoDb: client,
      })
      if (
        dynamoDBStreamObject.Keys.PartitionKeyID.S.includes(
          TRANSACTION_PRIMARY_KEY_IDENTIFIER
        )
      ) {
        const transaction = handlePrimaryItem(
          message
        ) as TransactionWithRulesResult
        console.info(`Processing transaction ${transaction.transactionId}`)
        await transactionHandler(db, tenantId, transaction)
        /*
         todo: this is not very efficient, because we recalculate all the
           statistics for each transaction. Need to implement updating
           a single record in DB using transaction date
         */
        await dashboardStatsRepository.refreshStats(tenantId)
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
        const userEvent = handlePrimaryItem(message) as UserEventWithRulesResult
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

const handlePrimaryItem = (message: string) => {
  const stremNewImage = JSON.parse(message).dynamodb.NewImage
  return unMarshallDynamoDBStream(JSON.stringify(stremNewImage))
}
