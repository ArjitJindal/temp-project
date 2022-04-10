import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { Db, MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import {
  TRANSACTION_PRIMARY_KEY_IDENTIFIER,
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
} from '@/utils/mongoDBUtils'
import { unMarshallDynamoDBStream } from '@/utils/dynamodbStream'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'

let client: MongoClient

function getTransactionStatus(
  rulesResult: ReadonlyArray<ExecutedRulesResult>
): RuleAction {
  const rulesPrecedences: RuleAction[] = ['BLOCK', 'FLAG', 'WHITELIST', 'ALLOW']
  return rulesResult
    .map((result) => result.ruleAction)
    .reduce((prev, curr) => {
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
      status: getTransactionStatus(transaction.executedRules),
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
    const aggregationCursor = await transactionsCollection.aggregate([
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
    await aggregationCursor.next()
  } catch (e) {
    console.log(`ERROR ${e}`)
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
        await transactionHandler(
          db,
          tenantId,
          handlePrimaryItem(message) as TransactionWithRulesResult
        )
      } else if (
        dynamoDBStreamObject.Keys.PartitionKeyID.S.includes(
          USER_PRIMARY_KEY_IDENTIFIER
        )
      ) {
        await userHandler(db, tenantId, handlePrimaryItem(message) as User)
      }
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
