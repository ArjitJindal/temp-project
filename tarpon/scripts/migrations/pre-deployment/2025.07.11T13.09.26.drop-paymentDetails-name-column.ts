import { migrateAllTenants } from '../utils/tenant'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { Tenant } from '@/services/accounts/repository'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabled()) {
    return
  }
  const client = await getClickhouseClient(tenant.id)
  const transactionsTable = CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName
  await client.query({
    query: `ALTER TABLE ${transactionsTable} DROP COLUMN originPaymentDetails_name`,
  })
  await client.query({
    query: `ALTER TABLE ${transactionsTable} DROP COLUMN destinationPaymentDetails_name`,
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
