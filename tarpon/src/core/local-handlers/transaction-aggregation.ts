import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { FifoSqsMessage } from '@/utils/sns-sqs-client'

export const handleTransactionAggregationTasks = async (
  messages: FifoSqsMessage[],
  dynamoDb: DynamoDBDocumentClient,
  mongoDb: MongoClient
) => {
  const {
    handleTransactionAggregationTask,
    handleV8TransactionAggregationTask,
  } = await import('@/lambdas/transaction-aggregation/app')
  for (const message of messages) {
    const payload = JSON.parse(message.MessageBody)
    if (payload.type === 'TRANSACTION_AGGREGATION') {
      await handleV8TransactionAggregationTask(payload, dynamoDb)
    } else {
      await handleTransactionAggregationTask(payload, dynamoDb, mongoDb)
    }
  }
}
