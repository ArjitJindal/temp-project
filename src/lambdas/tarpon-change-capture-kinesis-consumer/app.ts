import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { MongoClient } from 'mongodb'
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
        const dashboardCollection = db.collection(
          DASHBOARD_COLLECTION(tenantId)
        )

        const dateFromTS = new Date(transactionPrimaryItem.timestamp * 1000)

        await dashboardCollection.updateOne(
          { date: transactionPrimaryItem.timestamp },
          {
            $set: {
              date: `${dateFromTS.getDate()}${dateFromTS.getMonth()}${dateFromTS.getFullYear()}`,
              type: dashboardMetricsTypes.TRANSACTION_COUNT_STATISTICS,
              // TODO: Add rule hit stats once ready
            },
            $inc: { transactionsCount: 1 },
          },
          { upsert: true }
        )

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
