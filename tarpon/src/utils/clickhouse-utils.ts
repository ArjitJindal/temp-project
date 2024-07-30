import {
  ClickHouseClient,
  createClient,
  ResponseJSON,
} from '@clickhouse/client'
import { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config'
import { envIs } from './env'
import {
  ClickHouseTables,
  TableDefinition,
  TableName,
} from './clickhouse-definition'
import { getContext } from '@/core/utils/context'
import { getSecret } from '@/utils/secrets-manager'
import { logger } from '@/core/logger'

let client: ClickHouseClient

export async function getClickhouseClient() {
  if (envIs('local') || envIs('test')) {
    client = createClient({
      url: 'http://localhost:8123',
      username: 'default',
      database: envIs('test') ? 'tarpon_test' : 'tarpon',
    })
  }

  if (client) {
    return client
  }

  const config = await getSecret<NodeClickHouseClientConfigOptions>(
    'clickhouse'
  )

  client = createClient(config)

  return client
}

/**
 *
 * @param tableName {Use functions like TRANSACTIONS_COLLECTION, USERS_COLLECTION, etc.}
 * @param object {The object to insert}
 * @param tenantId {The tenantId to insert the object to}
 */

function assertTableName(
  tableName: string,
  tenantId: string = getContext()?.tenantId as string
): TableDefinition {
  let trimmedTableName = tableName
    .replace(/-/g, '_')
    .replace(tenantId.replace(/-/g, '_'), '')

  if (trimmedTableName.startsWith('_')) {
    trimmedTableName = trimmedTableName.slice(1)
  }

  const tableDefinition = ClickHouseTables.find(
    (t) => t.table === trimmedTableName
  )

  if (!tableDefinition) {
    throw new Error(`Table definition not found for table ${tableName}`)
  }

  return tableDefinition
}

export async function insertToClickhouse(
  tableName: TableName,
  object: object,
  tenantId: string = getContext()?.tenantId as string
) {
  if (!envIs('local') || !envIs('dev') || !envIs('test')) {
    return
  }

  const tableDefinition = assertTableName(tableName, tenantId)
  const client = await getClickhouseClient()
  await client.insert({
    table: sanitizeTableName(tableName),
    values: [
      { id: object[tableDefinition.idColumn], data: JSON.stringify(object) },
    ],
    columns: ['id', 'data'],
    format: 'JSON',
  })
}

export async function batchInsertToClickhouse(
  table: TableName,
  objects: object[],
  tenantId = getContext()?.tenantId as string
) {
  const tableDefinition = assertTableName(table, tenantId)
  await (
    await getClickhouseClient()
  ).insert({
    table: sanitizeTableName(table),
    values: objects.map((object) => ({
      id: object[tableDefinition.idColumn],
      data: JSON.stringify(object),
    })),
    columns: ['id', 'data'],
    format: 'JSON',
  })
}

export const getCreateTableQuery = (
  table: TableDefinition,
  tenantId: string
) => {
  const tableName = `${tenantId}_${table.table}`.replace(/-/g, '_')

  const materializedColumnNames = table.materializedColumns
    ?.map((col) => col.split(' ')[0])
    .join(', ')

  return `
    CREATE TABLE ${tableName} (
      id String PRIMARY KEY,
      data String,
      timestamp UInt64 MATERIALIZED JSONExtractUInt(data, '${
        table.timestampColumn
      }')
      ${table.materializedColumns?.length ? ',' : ''}
      ${table.materializedColumns?.join(', ') ?? ''}
      ${table.projections?.length ? ',' : ''}
      ${`${
        table.projections?.map(
          (p) =>
            `PROJECTION ${p.name} (SELECT id, timestamp, ${materializedColumnNames} ORDER BY ${p.key})`
        ) ?? ''
      }`}
    ) ENGINE = ReplacingMergeTree()
    ORDER BY id
    PARTITION BY toYYYYMM(toDateTime(timestamp))
    SETTINGS index_granularity = 8192
  `
}

export async function createOrUpdateClickHouseTable(
  tenantId: string,
  table: TableDefinition
) {
  const tableName = `${tenantId}_${table.table}`.replace(/-/g, '_')
  const client = await getClickhouseClient()
  // Check if the table exists
  const checkTableQuery = `
    EXISTS TABLE ${tableName}
  `

  let tableExists = false
  try {
    const tableExistsResponse: ResponseJSON<{ result: number }> = await (
      await client.query({ query: checkTableQuery })
    ).json()

    tableExists = tableExistsResponse.data[0].result === 1
  } catch (e) {
    logger.info('Table doesnt exist', e)
  }

  const materializedColumnNames = table.materializedColumns
    ?.map((col) => col.split(' ')[0])
    .join(', ')
  if (!tableExists) {
    const createTableQuery = getCreateTableQuery(table, tenantId)
    await client.query({ query: createTableQuery })
  }

  const describeTableQuery = `
        DESCRIBE TABLE ${tableName}
      `
  const describeTableResponse: ResponseJSON<{
    name: string
    default_expression: string
  }> = await (await client.query({ query: describeTableQuery })).json()

  // Add missing materialized columns
  if (table.materializedColumns?.length) {
    for (const col of table.materializedColumns) {
      const colName = col.split(' ')[0]
      const expr = col.split('MATERIALIZED ')[1]
      const colType = col.split(' MATERIALIZED ')[0].split(`${colName} `)[1]
      const existingColumn = describeTableResponse.data.find(
        (col) => col.name === colName
      )
      if (!existingColumn) {
        const addColumnQuery = `
            ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType} MATERIALIZED ${expr}
          `
        await client.query({ query: addColumnQuery })
        logger.info(
          `Added missing materialized column ${colName} to table ${tableName}.`
        )
      }
    }
  }
  /** No way to alter projection so we need to recreate it with a different name */
  /** Don't forget to drop the old projection */
  /** Recommended when you are adding filters to the table */

  // Its not recommened to alter projection if already exists so we will only add missing projection
  if (table.projections?.length) {
    const showTable = (await (
      await client.query({
        query: `SHOW CREATE TABLE ${tableName}`,
      })
    ).json()) as ResponseJSON<{ statement: string }>
    const showTableStatement = showTable.data[0].statement
    for (const projection of table.projections) {
      const projectionName = projection.name
      const isProjectionExists = showTableStatement.includes(
        `PROJECTION ${projectionName}`
      )
      if (!isProjectionExists) {
        const addProjectionQuery = `
            ALTER TABLE ${tableName} ADD PROJECTION ${projectionName} (SELECT id, timestamp, ${materializedColumnNames} ORDER BY ${projection.key})
          `
        await client.query({ query: addProjectionQuery })
        await client.query({
          query: `ALTER TABLE ${tableName} MATERIALIZE PROJECTION ${projectionName}`,
        })
        logger.info(
          `Added missing projection ${projectionName} to table ${tableName}.`
        )
      }
    }
  }
}

export const sanitizeTableName = (tableName: string) =>
  tableName.replace(/-/g, '_')
