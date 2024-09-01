import {
  ClickHouseClient,
  ClickHouseSettings,
  createClient,
  InsertParams,
  ResponseJSON,
} from '@clickhouse/client'
import { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config'
import { envIs } from './env'
import {
  ClickHouseTables,
  MaterializedViewDefinition,
  ProjectionsDefinition,
  TableDefinition,
  TableName,
} from './clickhouse-definition'
import { getContext, hasFeature } from '@/core/utils/context'
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
 * @param tableName with tenantId
 * @param projection {The projection to insert the object to}
 */

export const getProjectionName = (
  tableName: string,
  projection: ProjectionsDefinition
) => {
  const projectionName = projection.name
  const version = projection.version

  return sanitizeTableName(`${tableName}_${projectionName}_v${version}_proj`)
}

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

const clickhouseInsert = async (
  table: string,
  values: object[],
  columns: InsertParams['columns']
) => {
  const client = await getClickhouseClient()

  const CLICKHOUSE_SETTINGS: ClickHouseSettings = {
    wait_for_async_insert: envIs('test', 'local') ? 1 : 0,
    async_insert: envIs('test', 'local') ? 0 : 1,
    http_retry_initial_backoff_ms: '1000',
  }

  await client.insert({
    table,
    values,
    columns: columns,
    format: 'JSON',
    clickhouse_settings: CLICKHOUSE_SETTINGS,
  })
}

export async function insertToClickhouse(
  tableName: TableName,
  object: object,
  tenantId: string = getContext()?.tenantId as string
) {
  if (!envIs('local') && !envIs('test') && !envIs('dev')) {
    return
  }

  const tableDefinition = assertTableName(tableName, tenantId)

  if (envIs('test')) {
    if (!hasFeature('CLICKHOUSE_ENABLED')) {
      return
    } else {
      await createOrUpdateClickHouseTable(tenantId, tableDefinition)
    }
  }

  await clickhouseInsert(
    sanitizeTableName(tableName),
    [{ id: object[tableDefinition.idColumn], data: JSON.stringify(object) }],
    ['id', 'data']
  )
}

export async function batchInsertToClickhouse(
  table: TableName,
  objects: object[],
  tenantId = getContext()?.tenantId as string
) {
  const tableDefinition = assertTableName(table, tenantId)

  await clickhouseInsert(
    sanitizeTableName(table),
    objects.map((object) => ({
      id: object[tableDefinition.idColumn],
      data: JSON.stringify(object),
    })),
    ['id', 'data']
  )
}

export function formatTableName(tenantId: string, tableName: string): string {
  return sanitizeTableName(`${tenantId}-${tableName}`)
}

export const getCreateTableQuery = (
  table: TableDefinition,
  tenantId: string
) => {
  const tableName = formatTableName(tenantId, table.table)

  return `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id String,
      data String,
      timestamp UInt64 MATERIALIZED JSONExtractUInt(data, '${
        table.timestampColumn
      }')
      ${table.materializedColumns?.length ? ',' : ''}
      ${table.materializedColumns?.join(', ') ?? ''}
    ) ENGINE = ${table.engine}
     ${table.projections?.length ? ',' : ''}
     ${
       table.projections?.length
         ? table.projections
             ?.map((projection) => {
               const projectionName = getProjectionName(tableName, projection)
               const columns = projection.definition.columns.join(', ')

               return `PROJECTION ${projectionName} (SELECT ${columns} ${projection.definition.aggregator} BY ${projection.definition.aggregatorBy})`
             })
             .join(', ')
         : ''
     }
    ORDER BY ${table.orderBy}
    PRIMARY KEY ${table.primaryKey}
    ${table.partitionBy ? `PARTITION BY ${table.partitionBy}` : ''}
    SETTINGS index_granularity = 8192
  `
}

export async function createOrUpdateClickHouseTable(
  tenantId: string,
  table: TableDefinition
) {
  const tableName = formatTableName(tenantId, table.table)
  const client = await getClickhouseClient()

  await createTableIfNotExists(client, tableName, table, tenantId)
  await addMissingMaterializedColumns(client, tableName, table)
  await addMissingProjections(client, tableName, table)
  await createMaterializedViews(client, tenantId, table)
}

async function createTableIfNotExists(
  client: ClickHouseClient,
  tableName: string,
  table: TableDefinition,
  tenantId: string
): Promise<void> {
  const tableExists = await checkTableExists(client, tableName)
  if (!tableExists) {
    const createTableQuery = getCreateTableQuery(table, tenantId)
    await client.query({ query: createTableQuery })
  }
}

async function checkTableExists(
  client: ClickHouseClient,
  tableName: string
): Promise<boolean> {
  const checkTableQuery = `EXISTS TABLE ${tableName}`
  const response: ResponseJSON<{ result: number }> = await (
    await client.query({ query: checkTableQuery })
  ).json()
  return response.data[0].result === 1
}

async function addMissingMaterializedColumns(
  client: ClickHouseClient,
  tableName: string,
  table: TableDefinition
): Promise<void> {
  if (!table.materializedColumns?.length) {
    return
  }

  const existingColumns = await getExistingColumns(client, tableName)

  for (const col of table.materializedColumns) {
    const [colName, colType, expr] = parseColumnDefinition(col)
    if (!existingColumns.find((c) => c.name === colName)) {
      await addMaterializedColumn(client, tableName, colName, colType, expr)
    }
  }
}

async function getExistingColumns(client: ClickHouseClient, tableName: string) {
  const describeTableQuery = `DESCRIBE TABLE ${tableName}`
  const response: ResponseJSON<{ name: string; default_expression: string }> =
    await (await client.query({ query: describeTableQuery })).json()
  return response.data
}

function parseColumnDefinition(col: string): [string, string, string] {
  const [colName, ...rest] = col.split(' ')
  const expr = rest.join(' ').split('MATERIALIZED ')[1]
  const colType = rest.join(' ').split(' MATERIALIZED ')[0]
  return [colName, colType, expr]
}

async function addMaterializedColumn(
  client: ClickHouseClient,
  tableName: string,
  colName: string,
  colType: string,
  expr: string
): Promise<void> {
  const addColumnQuery = `
    ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType} MATERIALIZED ${expr}
  `
  await client.query({ query: addColumnQuery })
  logger.info(
    `Added missing materialized column ${colName} to table ${tableName}.`
  )
}

async function addMissingProjections(
  client: ClickHouseClient,
  tableName: string,
  table: TableDefinition
): Promise<void> {
  if (!table.projections?.length) {
    return
  }

  const showTableStatement = await getShowTableStatement(client, tableName)

  for (const projection of table.projections) {
    const projectionName = getProjectionName(tableName, projection)
    if (!showTableStatement.includes(`PROJECTION ${projectionName}`)) {
      await addProjection(client, tableName, projection)
    }
  }
}

async function getShowTableStatement(
  client: ClickHouseClient,
  tableName: string
): Promise<string> {
  const showTable = await client.query({
    query: `SHOW CREATE TABLE ${tableName}`,
  })
  const response = (await showTable.json()) as ResponseJSON<{
    statement: string
  }>
  return response.data[0].statement
}

async function addProjection(
  client: ClickHouseClient,
  tableName: string,
  projection: ProjectionsDefinition
): Promise<void> {
  const columns = projection.definition.columns.join(', ')
  const projectionName = getProjectionName(tableName, projection)
  const addProjectionQuery = `
    ALTER TABLE ${tableName} ADD PROJECTION ${projectionName} 
    (SELECT ${columns} ${projection.definition.aggregator} BY ${projection.definition.aggregatorBy})
  `
  await client.query({ query: addProjectionQuery })
  await client.query({
    query: `ALTER TABLE ${tableName} MATERIALIZE PROJECTION ${projectionName}`,
  })
  logger.info(
    `Added missing projection ${projection.name} to table ${tableName}.`
  )
}

export const createMaterializedTableQuery = (
  tenantId: string,
  view: MaterializedViewDefinition
) => {
  return `
    CREATE TABLE IF NOT EXISTS ${formatTableName(tenantId, view.table)} (
      ${view.columns.join(', ')}
    ) ENGINE = ${view.engine}()
    ORDER BY ${view.orderBy}
    PRIMARY KEY ${view.primaryKey}
    ${view.partitionBy ? `PARTITION BY ${view.partitionBy}` : ''}
    SETTINGS index_granularity = 8192
  `
}

export const createMaterializedViewQuery = (
  tenantId: string,
  view: MaterializedViewDefinition,
  tableName: string
) => {
  return `
    CREATE MATERIALIZED VIEW IF NOT EXISTS ${formatTableName(
      tenantId,
      view.viewName
    )} TO ${formatTableName(tenantId, view.table)}
    AS (
      SELECT ${view.columns.map((col) => col.split(' ')[0]).join(', ')}
      FROM ${formatTableName(tenantId, tableName)}
    )
  `
}

async function createMaterializedViews(
  client: ClickHouseClient,
  tenantId: string,
  table: TableDefinition
): Promise<void> {
  if (!table.materializedViews?.length) {
    return
  }

  for (const view of table.materializedViews) {
    const createViewQuery = createMaterializedTableQuery(tenantId, view)
    await client.query({ query: createViewQuery })
    const matQuery = createMaterializedViewQuery(tenantId, view, table.table)
    await client.query({ query: matQuery })
  }
}

export const sanitizeTableName = (tableName: string) =>
  tableName.replace(/-/g, '_')
