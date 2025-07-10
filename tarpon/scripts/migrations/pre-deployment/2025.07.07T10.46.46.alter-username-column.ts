import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import {
  getClickhouseClient,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import {
  userNameMaterilizedColumn,
  userNameCasesV2MaterializedColumn,
} from '@/utils/clickhouse/definition'

async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }

  const clickhouseClient = await getClickhouseClient(tenant.id)

  const modifyQueries = [
    // Modify username column definition in users table
    `ALTER TABLE users MODIFY COLUMN ${userNameMaterilizedColumn}`,
    // Modify userName column definition in cases table
    `ALTER TABLE cases MODIFY COLUMN ${userNameCasesV2MaterializedColumn}`,
    // Modify userName column definition in cases_v2 table
    `ALTER TABLE cases_v2 MODIFY COLUMN ${userNameCasesV2MaterializedColumn}`,
    // Modify username column definition in users_by_id materialized view table
    `ALTER TABLE users_by_id MODIFY COLUMN ${userNameMaterilizedColumn}`,
  ]

  const materializeQueries = [
    // Materialize username column in users table
    'ALTER TABLE users MATERIALIZE COLUMN username',
    // Materialize userName column in cases table
    'ALTER TABLE cases MATERIALIZE COLUMN userName',
    // Materialize userName column in cases_v2 table
    'ALTER TABLE cases_v2 MATERIALIZE COLUMN userName',
    'ALTER TABLE users_by_id MATERIALIZE COLUMN username',
  ]

  // First, modify the column definitions
  for (const query of modifyQueries) {
    try {
      console.log(`Executing MODIFY query for tenant ${tenant.id}: ${query}`)
      await clickhouseClient.exec({ query })
      console.log(`Successfully executed MODIFY query for tenant ${tenant.id}`)
    } catch (error) {
      console.error(
        `Failed to execute MODIFY query for tenant ${tenant.id}:`,
        error
      )
      throw error
    }
  }

  // Then, materialize the columns to recalculate existing data
  for (const query of materializeQueries) {
    try {
      console.log(`Executing MATERIALIZE query for tenant ${tenant.id}`)
      await clickhouseClient.exec({ query })
      console.log(
        `Successfully executed MATERIALIZE query for tenant ${tenant.id}`
      )
    } catch (error) {
      console.error(
        `Failed to execute MATERIALIZE query "${query}" for tenant ${tenant.id}:`,
        error
      )
      throw error
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
