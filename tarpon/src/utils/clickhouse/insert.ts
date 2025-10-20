import { InsertParams, ClickHouseSettings } from '@clickhouse/client'
import { envIs } from '../env'
import { isClickhouseEnabledInRegion } from './checks'
import { getClickhouseClient } from './client'
import { sanitizeSqlName } from './sanitize'
import { executeWithBackoff } from './executeWithBackoff'
import { getContext } from '@/core/utils/context-storage'
import { CLICKHOUSE_ID_COLUMN_MAP } from '@/constants/clickhouse/id-column-map'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'

function assertTableName(
  tableName: string,
  tenantId: string = getContext()?.tenantId as string
): boolean {
  let trimmedTableName = tableName
    .replace(/-/g, '_')
    .replace(tenantId.replace(/-/g, '_'), '')

  if (trimmedTableName.startsWith('_')) {
    trimmedTableName = trimmedTableName.slice(1)
  }

  const tableDefinition = Object.values(ClickhouseTableNames).some(
    (t) => t === trimmedTableName
  )

  if (!tableDefinition) {
    throw new Error(`Table definition not found for table ${tableName}`)
  }

  return !!tableDefinition
}
const clickhouseInsert = async (
  tenantId: string,
  table: string,
  values: object[],
  columns: InsertParams['columns']
) => {
  const client = await getClickhouseClient(tenantId)

  const CLICKHOUSE_SETTINGS: ClickHouseSettings = {
    wait_for_async_insert: 1,
    async_insert: envIs('test', 'local') ? 0 : 1,
  }

  await executeWithBackoff(
    async () => {
      await client.insert({
        table,
        values,
        columns: columns,
        format: 'JSON',
        clickhouse_settings: CLICKHOUSE_SETTINGS,
      })
    },
    'insert',
    { table, tenantId }
  )
}

export async function prepareClickhouseInsert(
  tableName: ClickhouseTableNames,
  tenantId: string
): Promise<boolean> {
  if (!isClickhouseEnabledInRegion()) {
    return false
  }

  assertTableName(tableName, tenantId)

  if (envIs('test')) {
    const { prepareClickhouseInsertLocal } = await import(
      '@/core/local-handlers/clickhouse'
    )

    return await prepareClickhouseInsertLocal(tenantId, tableName)
  }

  return true
}

export async function batchInsertToClickhouse(
  tenantId: string,
  table: ClickhouseTableNames,
  objects: object[]
) {
  const tableDefinition = await prepareClickhouseInsert(table, tenantId)
  if (!tableDefinition) {
    return
  }

  const insertData = objects.map((object) => ({
    id: object[CLICKHOUSE_ID_COLUMN_MAP[table]],
    data: JSON.stringify(object),
    is_deleted: 0,
  }))

  await clickhouseInsert(tenantId, sanitizeSqlName(table), insertData, [
    'id',
    'data',
    'is_deleted',
  ])

  // For transactions, also write to transactions_desc table
  if (table === CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName) {
    const tableDefinition = await prepareClickhouseInsert(
      CLICKHOUSE_DEFINITIONS.TRANSACTIONS_DESC.tableName,
      tenantId
    )
    if (!tableDefinition) {
      return
    }
    await clickhouseInsert(
      tenantId,
      sanitizeSqlName(CLICKHOUSE_DEFINITIONS.TRANSACTIONS_DESC.tableName),
      insertData,
      ['id', 'data', 'is_deleted']
    )
  }
}
