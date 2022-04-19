import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { Db, MongoClient } from 'mongodb'
import { TarponStackConstants } from '@cdk/constants'
import {
  TRANSACTION_PRIMARY_KEY_IDENTIFIER,
  USER_PRIMARY_KEY_IDENTIFIER,
} from './constants'
import {
  connectToDB,
  TRANSACIONS_COLLECTION,
  USERS_COLLECTION,
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
    TRANSACIONS_COLLECTION(tenantId)
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

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  try {
    client = await connectToDB()
    const db = client.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    for (const record of event.Records) {
      const payload: KinesisStreamRecordPayload = record.kinesis
      const message: string = Buffer.from(payload.data, 'base64').toString()
      const dynamoDBStreamObject = JSON.parse(message).dynamodb
      const tenantId = dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]

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
