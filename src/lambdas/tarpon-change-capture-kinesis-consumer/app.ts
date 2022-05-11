import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { Db, MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import {
  TRANSACTION_PRIMARY_KEY_IDENTIFIER,
  USER_EVENT_KEY_IDENTIFIER,
  USER_PRIMARY_KEY_IDENTIFIER,
} from './constants'
import {
  connectToDB,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  MONTH_DATE_FORMAT,
  DAY_DATE_FORMAT,
  HOUR_DATE_FORMAT,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { unMarshallDynamoDBStream } from '@/utils/dynamodbStream'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { UserEventWithRulesResult } from '@/@types/openapi-public/UserEventWithRulesResult'

let client: MongoClient

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
  transaction.executedRules
  await transactionsCollection.replaceOne(
    { transactionId: transaction.transactionId },
    {
      ...transaction,
      status: getAggregatedRuleStatus(
        transaction.executedRules.map((rule) => rule.ruleAction)
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

const dashboardTransactionStatsHandler = async (
  db: Db,
  tenantId: string,
  aggregatedCollectionName: string,
  dateIdFormat: string
) => {
  const transactionsCollection = db.collection<TransactionCaseManagement>(
    TRANSACTIONS_COLLECTION(tenantId)
  )
  try {
    await transactionsCollection
      .aggregate([
        { $match: { timestamp: { $gte: 0 } } }, // aggregates everything for now
        {
          $group: {
            _id: {
              $dateToString: {
                format: dateIdFormat,
                date: { $toDate: { $toLong: '$timestamp' } },
              },
            },
            transactionsCount: { $sum: 1 },
          },
        },
        {
          $merge: {
            into: aggregatedCollectionName,
            whenMatched: 'replace',
          },
        },
      ])
      .next()
  } catch (e) {
    console.error(`ERROR ${e}`)
  }
}

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  try {
    let tenantId
    client = await connectToDB()
    const db = client.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    for (const record of event.Records) {
      const payload: KinesisStreamRecordPayload = record.kinesis
      const message: string = Buffer.from(payload.data, 'base64').toString()
      const dynamoDBStreamObject = JSON.parse(message).dynamodb
      tenantId = dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]

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
        await dashboardTransactionStatsHandler(
          db,
          tenantId,
          DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId),
          MONTH_DATE_FORMAT
        )
        await dashboardTransactionStatsHandler(
          db,
          tenantId,
          DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId),
          DAY_DATE_FORMAT
        )
        await dashboardTransactionStatsHandler(
          db,
          tenantId,
          DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId),
          HOUR_DATE_FORMAT
        )
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
