import { logger } from '../logger'
import { seedDynamo } from './dynamodb'
import { seedMongo } from './mongo'
import { fetchAndSetAccounts } from './account-setup'
import { getUsers } from './data/users'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  getClickhouseClient,
  createTenantDatabase,
} from '@/utils/clickhouse/utils'
import { ClickHouseTables } from '@/utils/clickhouse/definition'

export async function seedDemoData(tenantId: string) {
  const dynamo = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const clickhouseClient = await getClickhouseClient(tenantId)

  const promises = ClickHouseTables.map(async (table) => {
    try {
      await clickhouseClient.exec({
        query: `DELETE FROM ${table.table} WHERE 1=1`,
      })
    } catch (error) {
      // error code 60 is returned when the table does not exist
      // error code 81 is returned when the database does not exist
      if (
        error instanceof Error &&
        'code' in error &&
        (error.code == 60 || error.code == 81)
      ) {
        logger.warn(`Table ${table.table} does not exist`)
      } else {
        logger.warn(`Failed to delete from table ${table.table}: ${error}`)
        throw error
      }
    }
  })
  await Promise.all(promises)

  await fetchAndSetAccounts(tenantId, dynamo)
  await createTenantDatabase(tenantId)
  // necessary to get the users first before seeding the rest
  logger.info('Creating mock users...')
  await getUsers(tenantId)
  await seedDynamo(dynamo, tenantId)
  await seedMongo(tenantId, mongoDb, dynamo)
}
