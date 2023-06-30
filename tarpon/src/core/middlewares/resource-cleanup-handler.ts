import { cleanUpDynamoDbResources } from '@/utils/dynamodb'

export const resourceCleanupHandler =
  () =>
  (handler: CallableFunction): CallableFunction =>
  async (event: unknown, context: unknown): Promise<unknown> => {
    try {
      return await handler(event, context)
    } finally {
      cleanUpDynamoDbResources()
    }
  }
