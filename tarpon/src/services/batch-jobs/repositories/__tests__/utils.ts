import { BatchJobRepository } from '../batch-job-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const getBatchJobRepository = async (tenantId: string) => {
  const mongoDb = await getMongoDbClient()
  return new BatchJobRepository(tenantId, mongoDb)
}
