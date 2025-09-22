import { MongoConsumerMessage } from '@/@types/mongo'

export const handleLocalMongoDbTrigger = async (
  messages: MongoConsumerMessage[]
) => {
  const { handleMongoConsumerSQSMessage } = await import(
    '@/lambdas/mongo-db-trigger-consumer/app'
  )
  await handleMongoConsumerSQSMessage(messages)
}
