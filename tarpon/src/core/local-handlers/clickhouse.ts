import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { createOrUpdateClickHouseTable } from '@/utils/clickhouse/utils'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'
import { ClickHouseTables } from '@/utils/clickhouse/definition'

const testCache = new Set()

export const prepareClickhouseInsertLocal = async (
  tenantId: string,
  tableName: ClickhouseTableNames
): Promise<boolean> => {
  if (!isClickhouseEnabled()) {
    return false
  }
  const cacheKey = `${tenantId}-${tableName}`
  if (!testCache.has(cacheKey)) {
    const tableDefinition = ClickHouseTables.find((t) => t.table === tableName)
    if (!tableDefinition) {
      return false
    }
    await createOrUpdateClickHouseTable(tenantId, tableDefinition)
    testCache.add(cacheKey)
  }
  return true
}
