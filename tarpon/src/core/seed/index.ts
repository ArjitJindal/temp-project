import { logger } from '../logger'
import { seedDynamo } from './dynamodb'
import { seedMongo } from './mongo'
import { fetchAndSetAccounts } from './account-setup'
import { getUsers } from './data/users'
import { seedClickhouse } from './clickhouse'
import { removeDemoRoles } from './roles-setup'
import { getReports } from './data/reports'
import { deleteXMLFileFromS3 } from './samplers/report'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { createTenantDatabase } from '@/utils/clickhouse/utils'

export async function seedDemoData(tenantId: string) {
  const dynamo = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const account = await fetchAndSetAccounts(tenantId, dynamo)
  await removeDemoRoles(tenantId, account, dynamo)
  await createTenantDatabase(tenantId)
  // necessary to get the users first before seeding the rest
  logger.info('Creating mock users...')
  await getUsers(tenantId)
  await deleteXMLFileFromS3(tenantId)
  await getReports(tenantId)
  await seedDynamo(dynamo, tenantId)
  await seedMongo(tenantId, mongoDb, dynamo)
  await seedClickhouse(tenantId)
}
