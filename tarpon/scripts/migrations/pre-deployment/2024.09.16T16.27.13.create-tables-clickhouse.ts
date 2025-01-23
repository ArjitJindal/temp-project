import { migrateAllTenants } from '../utils/tenant'
import {
  createTenantDatabase,
  executeClickhouseDefaultClientQuery,
  getClickhouseClient,
  getClickhouseDbName,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts/repository'
import { envIsNot } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (envIsNot('local') && envIsNot('dev')) {
    return
  }

  const databaseExists = await executeClickhouseDefaultClientQuery(
    async (client) => {
      const databases = await client.query({
        query: 'SHOW DATABASES',
        format: 'JSONEachRow',
      })
      const databasesData = await databases.json<{ name: string }>()
      return databasesData.some(
        (db) => db.name === getClickhouseDbName(tenant.id)
      )
    }
  )

  if (!databaseExists) {
    await createTenantDatabase(tenant.id)
    return
  }

  const clickhouseClient = await getClickhouseClient(tenant.id)

  // list all tables and delete them
  const tables = await clickhouseClient.query({
    query: 'SHOW TABLES',
    format: 'JSONEachRow',
  })
  const tablesData = await tables.json<{ name: string }>()

  for (const table of tablesData) {
    const tableName = table.name
    const dropTableQuery = `DROP TABLE IF EXISTS ${tableName}`
    await clickhouseClient.query({ query: dropTableQuery })
  }

  await createTenantDatabase(tenant.id)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
