import { SQSEvent } from 'aws-lambda'
import { Document } from 'mongodb'
import pMap from 'p-map'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient, MongoUpdateMessage } from '@/utils/mongodb-utils'
import { sendMessageToMongoConsumer } from '@/utils/clickhouse/utils'

export const mongoUpdateConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const events = event.Records.map((record) =>
      JSON.parse(record.body)
    ) as MongoUpdateMessage[]

    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()

    await pMap(
      events,
      async (event) => {
        const collection = db.collection<Document>(event.collectionName)
        const data = await collection.updateOne(
          event.filter,
          event.updateMessage,
          { upsert: event.upsert || false }
        )

        if (event.sendToClickhouse) {
          await sendMessageToMongoConsumer({
            clusterTime: Date.now(),
            collectionName: event.collectionName,
            documentKey: {
              type: 'id',
              value: String(data.upsertedId),
            },
            operationType: 'update',
          })
        }
      },
      { concurrency: 10 }
    )
  }
)
