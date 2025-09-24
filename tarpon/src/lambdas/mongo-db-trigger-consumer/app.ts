import { SQSEvent } from 'aws-lambda'
import { MongoDbConsumer } from '.'
import { MongoConsumerMessage } from '@/@types/mongo'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

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
    ) as MongoConsumerMessage[]

    const mongoClient = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    await new MongoDbConsumer(mongoClient, dynamoDb).handleMongoConsumerMessage(
      events
    )
  }
)

export async function handleMongoConsumerSQSMessage(
  events: MongoConsumerMessage[]
) {
  const mongoClient = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  await new MongoDbConsumer(mongoClient, dynamoDb).handleMongoConsumerMessage(
    events
  )
}
