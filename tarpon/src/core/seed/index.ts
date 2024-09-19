import { seedDynamo } from './dynamodb'
import { seedMongo } from './mongo'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export async function seedDemoData(tenantId: string) {
  const dynamo = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  await seedDynamo(dynamo, tenantId)
  await seedMongo(mongoDb, tenantId)
  await mongoDb.close()
  await dynamo.destroy()
}
