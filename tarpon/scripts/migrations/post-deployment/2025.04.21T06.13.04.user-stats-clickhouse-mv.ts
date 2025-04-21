import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import {
  createMaterializedTableQuery,
  createMaterializedViewQuery,
  getClickhouseClient,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { KYC_STATUSS } from '@/@types/openapi-public-management-custom/KYCStatus'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
async function migrateTenant(tenant: Tenant) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }
  const client = await getClickhouseClient(tenant.id)
  const tableName = CLICKHOUSE_DEFINITIONS.USERS.tableName
  const usersClickHouseTable = ClickHouseTables.find(
    (t) => t.table === tableName
  )
  if (!usersClickHouseTable) {
    console.log(`ClickHouse table definition not found for table: ${tableName}`)
    return
  }
  const riskRepository = new RiskRepository(tenant.id, {
    dynamoDb: getDynamoDbClient(),
  })

  const riskClassifications = await riskRepository.getRiskClassificationValues()

  const riskClassificationQuery = (type: 'krs' | 'drs') =>
    riskClassifications
      .map(
        (item) =>
          `COUNTIf(${type}Score_${type}Score >= ${item.lowerBoundRiskScore} AND ${type}Score_${type}Score < ${item.upperBoundRiskScore}) AS ${type}RiskLevel_${item.riskLevel}`
      )
      .join(',\n')
  const userStateQuery = USER_STATES.map(
    (item) => `COUNTIf(userStateDetails_state = '${item}') AS userState_${item}`
  ).join(',\n')

  const kycStatusQuery = KYC_STATUSS.map(
    (item) =>
      `COUNTIf(kycStatusDetails_status = '${item}') AS kycStatus_${item}`
  ).join(',\n')
  for (const table of usersClickHouseTable?.materializedViews || []) {
    if (
      table.table === 'user_monthly_stats' ||
      table.table === 'user_daily_stats' ||
      table.table === 'user_hourly_stats'
    ) {
      await client.query({
        query: createMaterializedTableQuery(table),
      })
      await client.query({
        query: await createMaterializedViewQuery(table, tableName, tenant.id),
      })
      const timeFormat =
        table.table === 'user_monthly_stats'
          ? 'toStartOfMonth(toDateTime(timestamp / 1000))'
          : table.table === 'user_daily_stats'
          ? 'toDate(toDateTime(timestamp / 1000))'
          : 'toStartOfHour(toDateTime(timestamp / 1000))'
      const backfillQuery = `
        INSERT INTO ${table.table}
        SELECT
            ${timeFormat} AS time,
            type,
            -- KRS Risk Levels
            ${riskClassificationQuery('krs')},
            
            -- DRS Risk Levels
            ${riskClassificationQuery('drs')},
            
            -- User State Counts
            ${userStateQuery},
            
            -- KYC Status Counts
            ${kycStatusQuery}
        FROM ${tableName}
        WHERE toDateTime(timestamp / 1000) > toDateTime(0)
        GROUP BY toDateTime(timestamp / 1000), type
      `
      await client.query({
        query: backfillQuery,
      })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
