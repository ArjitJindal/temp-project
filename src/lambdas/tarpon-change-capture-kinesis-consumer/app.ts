import { KinesisStreamEvent } from 'aws-lambda'
import { MongoClient } from 'mongodb'
import { connectToDB, success, notFound } from './lib'

let client: MongoClient

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  // Implementation pending
  console.log('Kinesis Event')
  console.log(event)
  try {
    client = await connectToDB()
    const db = client.db('tarpon')
    const id = 'identifier'
    const dbItem = await db.collection('urls').findOne({ shortId: id })
    if (!dbItem) {
      return notFound({})
    }
  } catch (err) {
    console.error(err)
    return 'Internal error'
  } finally {
    await client.close()
  }
}
