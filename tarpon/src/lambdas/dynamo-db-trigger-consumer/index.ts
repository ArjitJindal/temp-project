import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import chunk from 'lodash/chunk'
import { StackConstants } from '@lib/constants'
import { logger } from '@/core/logger'
import { batchInsertToClickhouse } from '@/utils/clickhouse/utils'
import { batchGet } from '@/utils/dynamodb'
import { DynamoConsumerMessage } from '@/@types/dynamo'

export class DynamoDbConsumer {
  dynamoDb: DynamoDBDocumentClient

  constructor(dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
  }
  async handleDynamoConsumerMessage(messages: DynamoConsumerMessage[]) {
    logger.info('Processing DynamoDB consumer messages', {
      messageCount: messages.length,
    })
    await Promise.all(
      messages.map(async (event) => {
        const keys = event.items.map((item) => item.key)
        const updatedItems = await batchGet(
          this.dynamoDb,
          StackConstants.TARPON_DYNAMODB_TABLE_NAME(event.tenantId),
          keys
        )

        // Process in chunks to avoid overwhelming Clickhouse
        const updatedItemsWithTimestamp = updatedItems.map((item) => {
          if (!item || typeof item !== 'object') {
            return null
          }
          return {
            ...item,
            updatedAtClickhouse: Date.now(),
          }
        })
        const chunks = chunk(updatedItemsWithTimestamp.filter(Boolean), 1000)
        for (const batch of chunks) {
          await batchInsertToClickhouse(
            event.tenantId,
            event.tableName,
            batch as object[]
          )
        }
      })
    )
  }
}
