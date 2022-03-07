import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { DynamoDB } from 'aws-sdk'
import { MongoClient } from 'mongodb'
import { connectToDB, TRANSACIONS_COLLECTION } from '../../utils/docDBUtils'
import { unMarshallDynamoDBStream } from '../../utils/dynamodbStream'
import { TRANSACTION_PRIMARY_KEY_IDENTIFIER } from './constants'
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
        const stremNewImage = JSON.parse(message).dynamodb.NewImage
        const dynamoMessage = unMarshallDynamoDBStream(
          JSON.stringify(stremNewImage)
        )

        const collection = db.collection(TRANSACIONS_COLLECTION(tenantId))
        collection.insertOne(dynamoMessage)
      }
    }
  } catch (err) {
    console.error(err)
    return 'Internal error'
  } finally {
    await client.close()
  }
}
