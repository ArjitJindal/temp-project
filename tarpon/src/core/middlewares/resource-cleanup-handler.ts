import { getContext } from '../utils/context'

function cleanUpDynamoDbResources() {
  const dynamoDbClients = getContext()?.dynamoDbClients
  if (dynamoDbClients) {
    dynamoDbClients.forEach((client) => {
      client.destroy()
    })
  }
}

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
