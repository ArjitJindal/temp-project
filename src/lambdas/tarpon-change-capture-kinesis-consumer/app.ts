import { KinesisStreamEvent, KinesisStreamRecordPayload } from 'aws-lambda'
import { MongoClient } from 'mongodb'
import { connectToDB, success, notFound } from '../../utils/documentUtils'

let client: MongoClient

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  // Implementation pending
  try {
    client = await connectToDB()
    const db = client.db('tarpon')
    for (const record of event.Records) {
      const payload: KinesisStreamRecordPayload = record.kinesis
      const message: string = Buffer.from(payload.data, 'base64').toString()
      const dynamoMessage = JSON.parse(message)
      console.log(`DynamoDB update ${dynamoMessage}`)
      // Do something
    }
  } catch (err) {
    console.error(err)
    return 'Internal error'
  } finally {
    await client.close()
  }
}
