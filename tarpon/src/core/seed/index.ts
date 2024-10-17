import { seedDynamo } from './dynamodb'
import { seedMongo } from './mongo'
import { fetchAndSetAccounts } from './account-setup'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export async function seedDemoData(tenantId: string) {
  const dynamo = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  await fetchAndSetAccounts(tenantId, mongoDb)
  await seedDynamo(dynamo, tenantId)
  await seedMongo(mongoDb, tenantId)
}
