import { FifoSqsMessage } from '@/utils/sns-sqs-client'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const handleV8PreAggregationTasks = async (
  messages: FifoSqsMessage[]
) => {
  const { handleV8PreAggregationTask } = await import(
    '@/lambdas/transaction-aggregation/app'
  )

  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  for (const message of messages) {
    const payload = JSON.parse(message.MessageBody)
    await handleV8PreAggregationTask(payload, dynamoDb, mongoDb)
  }
}
