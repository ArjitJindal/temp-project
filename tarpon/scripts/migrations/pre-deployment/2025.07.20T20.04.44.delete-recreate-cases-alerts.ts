import { ResponseJSON } from '@clickhouse/client'
import { migrateAllTenants } from '../utils/tenant'
import {
  getCreateTableQuery,
  getClickhouseClient,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts/repository'
import {
  ClickhouseTableDefinition,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  if (
    tenant.id !== 'sia-partners' &&
    tenant.id !== 'sia-partners-test' &&
    tenant.id !== 'flagright' &&
    tenant.id !== 'flagright-test'
  ) {
    return
  }
  if (!isClickhouseEnabledInRegion()) {
    return
  }
  const clickhouseClient = await getClickhouseClient(tenant.id)
  const dropTableQueries = [
    `DROP TABLE IF EXISTS cases_v2`,
    `DROP TABLE IF EXISTS alerts`,
  ]

  for (const query of dropTableQueries) {
    await clickhouseClient.exec({ query })
    logger.info(`Dropped table ${query}`)
  }
  const tablesToCreate: ClickhouseTableDefinition[] = []
  ClickHouseTables.forEach((table) => {
    if (table.table === 'cases_v2' || table.table === 'alerts') {
      tablesToCreate.push(table)
    }
  })

  for (const table of tablesToCreate) {
    const checkTableQuery = `EXISTS TABLE ${table.table}`
    const response: ResponseJSON<{ result: number }> = await (
      await clickhouseClient.query({ query: checkTableQuery })
    ).json()
    const tableExists = response.data[0].result === 1
    if (!tableExists) {
      const createTableQuery = getCreateTableQuery(table)
      await clickhouseClient.query({ query: createTableQuery })
      logger.info(createTableQuery)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
