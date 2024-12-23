import { seedDynamo } from './dynamodb'
import { seedMongo } from './mongo'
import { fetchAndSetAccounts } from './account-setup'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { createTenantDatabase } from '@/utils/clickhouse/utils'

export async function seedDemoData(tenantId: string) {
  const dynamo = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const clickhouseClient = await getClickhouseClient(tenantId)

  await Promise.all(
    ClickHouseTables.map(async (table) => {
      await clickhouseClient.exec({
        query: `DELETE FROM ${table.table} WHERE 1=1`,
      })
    })
  )

  await fetchAndSetAccounts(tenantId, mongoDb)
  await createTenantDatabase(tenantId)
  await seedDynamo(dynamo, tenantId)
  await seedMongo(mongoDb, tenantId)
}
