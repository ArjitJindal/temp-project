import { getDynamoDbRawClient } from '@/utils/dynamodb'

export const resourceCleanupHandler =
  () =>
  (handler: CallableFunction): CallableFunction =>
  async (event: unknown, context: unknown): Promise<unknown> => {
    try {
      return handler(event, context)
    } finally {
      const dynamodb = getDynamoDbRawClient()
      dynamodb.destroy()
    }
  }
