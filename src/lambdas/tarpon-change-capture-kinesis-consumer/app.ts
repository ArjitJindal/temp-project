import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { Db, MongoClient } from 'mongodb'
import {
  connectToDB,
  DASHBOARD_COLLECTION,
  TRANSACIONS_COLLECTION,
  USERS_COLLECTION,
} from '../../utils/docDBUtils'
import { unMarshallDynamoDBStream } from '../../utils/dynamodbStream'
import { TarponStackConstants } from '../../../lib/constants'
import {
  dashboardMetricsTypes,
  TRANSACTION_PRIMARY_KEY_IDENTIFIER,
  USER_PRIMARY_KEY_IDENTIFIER,
} from './constants'
import { RuleActionEnum } from '../../@types/rule/rule-instance'

let client: MongoClient

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  // Implementation pending
  try {
    client = await connectToDB()
    const db = client.db(TarponStackConstants.DOCUMENT_DB_DATABASE_NAME)
    for (const record of event.Records) {
      const payload: KinesisStreamRecordPayload = record.kinesis
      const message: string = Buffer.from(payload.data, 'base64').toString()
      const dynamoDBStreamObject = JSON.parse(message).dynamodb

      if (
        dynamoDBStreamObject.Keys.PartitionKeyID.S.includes(
          TRANSACTION_PRIMARY_KEY_IDENTIFIER
        )
      ) {
        const tenantId =
          dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]
        const transactionPrimaryItem = handlePrimaryItem(message)

        const transactionsCollection = db.collection(
          TRANSACIONS_COLLECTION(tenantId)
        )
        await transactionsCollection.insertOne(transactionPrimaryItem)
        await updateTransactionCountStats(transactionPrimaryItem, tenantId, db)
      } else if (
        dynamoDBStreamObject.Keys.PartitionKeyID.S.includes(
          USER_PRIMARY_KEY_IDENTIFIER
        )
      ) {
        const tenantId =
          dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]
        const userPrimaryItem = handlePrimaryItem(message)
        const userCollection = db.collection(USERS_COLLECTION(tenantId))
        await userCollection.insertOne(userPrimaryItem)
      }
    }
  } catch (err) {
    console.error(err)
    return 'Internal error'
  }
}

const updateTransactionCountStats = async (
  transactionPrimaryItem: any,
  tenantId: string,
  db: Db
) => {
  const executedRules = transactionPrimaryItem.executedRules
  const dateStringFromTimeStamp = new Date(
    transactionPrimaryItem.timestamp * 1000
  )
    .toISOString()
    .substring(0, 10)

  const dashboardCollection = db.collection(DASHBOARD_COLLECTION(tenantId))
  await dashboardCollection.updateOne(
    {
      _id: `${dashboardMetricsTypes.TRANSACTION_COUNT_STATISTICS}-${dateStringFromTimeStamp}`,
    },
    {
      $set: {
        _id: `${dashboardMetricsTypes.TRANSACTION_COUNT_STATISTICS}-${dateStringFromTimeStamp}`,
        date: `${dateStringFromTimeStamp}`,
        type: dashboardMetricsTypes.TRANSACTION_COUNT_STATISTICS,
        // TODO: Add rule hit stats once ready
      },
      $inc: {
        transactionsCount: 1,
        flaggedTransactionsCount: checkForTransactionStatus(
          executedRules,
          RuleActionEnum.FLAG
        ),
        blockedTransactionsCount: checkForTransactionStatus(
          executedRules,
          RuleActionEnum.BLOCK
        ),
      },
      checkForTransactionStatus,
    },
    { upsert: true }
  )
}

const checkForTransactionStatus = (executedRules: any, action: string) => {
  for (let i = 0; i < executedRules.length; i++) {
    if (executedRules[i].action === action && executedRules[i].ruleHit) {
      return 1
    }
  }
  return 0
}

const handlePrimaryItem = (message: string) => {
  const stremNewImage = JSON.parse(message).dynamodb.NewImage
  return unMarshallDynamoDBStream(JSON.stringify(stremNewImage))
}
