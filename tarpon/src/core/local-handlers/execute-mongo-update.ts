import { MongoUpdateMessage } from '@/@types/mongo'

export const handleLocalExecuteMongoUpdate = async (
  events: MongoUpdateMessage[]
) => {
  const { executeMongoUpdate } = await import(
    '@/lambdas/mongo-update-consumer/app'
  )
  await executeMongoUpdate(events)
}
