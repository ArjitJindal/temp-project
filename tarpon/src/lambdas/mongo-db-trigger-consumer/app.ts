import { EventBridgeEvent, SQSEvent } from 'aws-lambda'
import {
  ChangeStreamDeleteDocument,
  ChangeStreamInsertDocument,
  ChangeStreamReplaceDocument,
  ChangeStreamUpdateDocument,
} from 'mongodb'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { MongoDbConsumer } from '.'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/utils'

type ChangeStreamDocument =
  | ChangeStreamInsertDocument
  | ChangeStreamUpdateDocument
  | ChangeStreamReplaceDocument
  | ChangeStreamDeleteDocument

const sqs = new SQSClient({
  region: process.env.AWS_REGION,
})

export type MongoConsumerSQSMessage = {
  collectionName: string
  operationType: 'insert' | 'update' | 'replace' | 'delete'
  documentKey: {
    _id: string
  }
  clusterTime: number
}

export const mongoDbTriggerConsumerHandler = lambdaConsumer()(
  async (event: EventBridgeEvent<string, ChangeStreamDocument>) => {
    const queueUrl = process.env.MONGO_DB_CONSUMER_QUEUE_URL

    if (!queueUrl) {
      throw new Error('MONGO_DB_CONSUMER_QUEUE_URL is not set')
    }
    let timestamp = Date.now()

    if (event.detail.clusterTime) {
      const { T, I } = event.detail.clusterTime as unknown as {
        T: number
        I: number
      }

      timestamp = Number(`${T}${I}`)
    }

    logger.info('MongoDB trigger consumer event', {
      event,
    })

    const collectionName = event.detail.ns.coll

    const eventData: MongoConsumerSQSMessage = {
      collectionName,
      operationType: event.detail.operationType,
      documentKey: { _id: String(event.detail.documentKey._id) },
      clusterTime: timestamp,
    }

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(eventData),
      })
    )
  }
)

export const mongoDbTriggerQueueConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    if (!isClickhouseEnabledInRegion()) {
      logger.info(
        'Clickhouse is not enabled, skipping MongoDB trigger queue consumer'
      )
      return
    }
    const events = event.Records.map((record) =>
      JSON.parse(record.body)
    ) as MongoConsumerSQSMessage[]

    const mongoClient = await getMongoDbClient()

    await new MongoDbConsumer(mongoClient).handleMongoConsumerSQSMessage(events)
  }
)

export async function handleMongoConsumerSQSMessage(
  events: MongoConsumerSQSMessage[]
) {
  const mongoClient = await getMongoDbClient()

  await new MongoDbConsumer(mongoClient).handleMongoConsumerSQSMessage(events)
}
