import { SQSEvent } from 'aws-lambda'
import { Document, ModifyResult } from 'mongodb'
import pMap from 'p-map'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MongoUpdateMessage } from '@/@types/mongo'
import { sendMessageToMongoConsumer } from '@/utils/clickhouse/utils'
import { logger } from '@/core/logger'
import { CounterRepository } from '@/services/counter/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

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
      const idDetails = event.updateMessage.$setOnInsert
      let screeningId = idDetails?.screeningId
      const tenantId = event.collectionName.split('-')[0]
      let data: ModifyResult<Document> | undefined = undefined
      try {
        data = await collection.findOneAndUpdate(
          event.filter,
          event.updateMessage,
          {
            upsert: event.upsert || false,
            ...(event.arrayFilters ? { arrayFilters: event.arrayFilters } : {}),
            returnDocument: 'after',
          }
        )
      } catch (e) {
        if (
          (e as any).code === 11000 && //  Duplicate key error from mongoDB
          screeningId
        ) {
          const dynamoDb = getDynamoDbClient()
          const counterRepository = new CounterRepository(tenantId, {
            mongoDb: mongoClient,
            dynamoDb,
          })
          screeningId = await counterRepository.getNextCounterAndUpdate(
            'ScreeningDetails'
          )
          data = await collection.findOneAndUpdate(
            event.filter,
            {
              ...event.updateMessage,
              $setOnInsert: {
                ...event.updateMessage.$setOnInsert,
                screeningId: `S-${screeningId}`,
              },
            },
            {
              upsert: event.upsert || false,
              ...(event.arrayFilters
                ? { arrayFilters: event.arrayFilters }
                : {}),
              returnDocument: 'after',
            }
          )
        }
      }
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
