import { logger } from '../logger'
import { seedDynamo } from './dynamodb'
import { seedMongo } from './mongo'
import { fetchAndSetAccounts } from './account-setup'
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
      if (error instanceof Error && 'code' in error && error.code === 60) {
        logger.warn(`Table ${table.table} does not exist`)
      } else {
        logger.warn(`Failed to delete from table ${table.table}: ${error}`)
        throw error
      }
    }
  })
  await Promise.all(promises)

  await fetchAndSetAccounts(tenantId, mongoDb)
  await createTenantDatabase(tenantId)
  await seedDynamo(dynamo, tenantId)
  await seedMongo(mongoDb, tenantId)
}
