import { logger } from '../logger'
import { seedDynamo } from './dynamodb'
import { seedMongo } from './mongo'
import { fetchAndSetAccounts } from './account-setup'
import { getUsers } from './data/users'
import { seedClickhouse } from './clickhouse'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { createTenantDatabase } from '@/utils/clickhouse/utils'

export async function seedDemoData(tenantId: string) {
  const dynamo = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  await fetchAndSetAccounts(tenantId, dynamo)
  await createTenantDatabase(tenantId)
  // necessary to get the users first before seeding the rest
  logger.info('Creating mock users...')
  await getUsers(tenantId)
  await seedDynamo(dynamo, tenantId)
  await seedMongo(tenantId, mongoDb, dynamo)
  await seedClickhouse(tenantId)
}
