import { SQSEvent } from 'aws-lambda'
import { DynamoDbConsumer } from '@/lambdas/dynamo-db-trigger-consumer'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoConsumerMessage } from '@/@types/dynamo'

export const dynamoDbTriggerQueueConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const events = event.Records.map((record) =>
      JSON.parse(record.body)
    ) as DynamoConsumerMessage[]

    const dynamoDb = getDynamoDbClient()
    await new DynamoDbConsumer(dynamoDb).handleDynamoConsumerMessage(events)
  }
)
