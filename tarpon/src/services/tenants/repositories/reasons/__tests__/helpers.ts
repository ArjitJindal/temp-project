import { ReasonsRepository } from '../reasons-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

export async function getReasonsRepository(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  return new ReasonsRepository(tenantId, { mongoDb, dynamoDb })
}
