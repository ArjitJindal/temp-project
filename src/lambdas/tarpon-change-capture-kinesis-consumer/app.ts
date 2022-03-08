import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { MongoClient } from 'mongodb'
import {
  connectToDB,
  DASHBOARD_COLLECTION,
  TRANSACIONS_COLLECTION,
  USERS_COLLECTION,
} from '../../utils/docDBUtils'
import { unMarshallDynamoDBStream } from '../../utils/dynamodbStream'
import {
  dashboardMetricsTypes,
  TRANSACTION_PRIMARY_KEY_IDENTIFIER,
  USER_PRIMARY_KEY_IDENTIFIER,
} from './constants'
import { TarponStackConstants } from '../../../lib/constants'

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
        /*const dashboardMetrics = handleDashboardMetrics(transactionPrimaryItem)
        const dashboardCollection = db.collection(
          DASHBOARD_COLLECTION(tenantId)
        )
        await dashboardCollection.updateOne(
          { date: transactionPrimaryItem.timestamp },
          dashboardMetrics,
          { upsert: true }
        )*/

        const transactionsCollection = db.collection(
          TRANSACIONS_COLLECTION(tenantId)
        )
        await transactionsCollection.insertOne(transactionPrimaryItem)
      } else if (
        dynamoDBStreamObject.Keys.PartitionKeyID.S.includes(
          USER_PRIMARY_KEY_IDENTIFIER
        )
      ) {
        const tenantId =
          dynamoDBStreamObject.Keys.PartitionKeyID.S.split('#')[0]
        const userPrimaryItem = handlePrimaryItem(message)
        console.log('userPrimaryItem: ')
        console.log(userPrimaryItem)
        const userCollection = db.collection(USERS_COLLECTION(tenantId))
        await userCollection.insertOne(userPrimaryItem)
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

const handleDashboardMetrics = (transactionPrimaryItem: {
  [key: string]: any
}) => {
  return {
    $set: {
      type: dashboardMetricsTypes.TRANSACTION_COUNT_STATISTICS,
      $inc: { transactionsCount: 1 },
    },
  }
}
