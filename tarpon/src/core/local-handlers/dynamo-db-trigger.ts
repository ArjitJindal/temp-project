// Direct processing for local/test environments

import { DynamoConsumerMessage } from '@/@types/dynamo'

export const handleLocalDynamoDbTrigger = async (
  message: DynamoConsumerMessage
) => {
  const { dynamoDbTriggerQueueConsumerHandler } = await import(
    '@/lambdas/dynamo-db-trigger-consumer/app'
  )
  await dynamoDbTriggerQueueConsumerHandler({
    Records: [
      {
        body: JSON.stringify(message),
      },
    ],
  })
  return
}
