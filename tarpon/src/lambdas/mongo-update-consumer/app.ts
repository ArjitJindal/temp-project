import { SQSEvent } from 'aws-lambda'
import { Document } from 'mongodb'
import pMap from 'p-map'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MongoUpdateMessage } from '@/@types/mongo'
import { sendMessageToMongoConsumer } from '@/utils/clickhouse/utils'
import { logger } from '@/core/logger'

export const mongoUpdateConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const events = event.Records.map((record) =>
      JSON.parse(record.body)
    ) as MongoUpdateMessage[]

    await executeMongoUpdate(events)
  }
)

export const executeMongoUpdate = async (events: MongoUpdateMessage[]) => {
  const mongoClient = await getMongoDbClient()
  const db = mongoClient.db()

  await pMap(
    events,
    async (event) => {
      const collection = db.collection<Document>(event.collectionName)
      const data = await collection.findOneAndUpdate(
        event.filter,
        event.updateMessage,
        {
          upsert: event.upsert || false,
          ...(event.arrayFilters ? { arrayFilters: event.arrayFilters } : {}),
          returnDocument: 'after',
        }
      )

      if (!data?.value?._id) {
        logger.warn(
          `Mongo update consumer: No _id found for event ${event.collectionName}`,
          { event }
        )
        return
      }

      if (event.sendToClickhouse) {
        await sendMessageToMongoConsumer({
          clusterTime: Date.now(),
          collectionName: event.collectionName,
          documentKey: {
            type: 'id',
            value: String(data.value._id),
          },
          operationType: 'update',
        })
      }
    },
    { concurrency: 10 }
  )
}
