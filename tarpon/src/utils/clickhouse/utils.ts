import {
  ClickHouseClient,
  ClickHouseSettings,
  createClient,
  InsertParams,
  ResponseJSON,
} from '@clickhouse/client'
import { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config'
import { chain, maxBy } from 'lodash'
import { backOff } from 'exponential-backoff'
import { SendMessageCommand, SQS } from '@aws-sdk/client-sqs'
import { envIs } from '../env'
import {
  ClickHouseTables,
  MaterializedViewDefinition,
  ProjectionsDefinition,
  ClickhouseTableDefinition,
  TableName,
} from './definition'
import { getContext, hasFeature } from '@/core/utils/context'
import { getSecret } from '@/utils/secrets-manager'
import { logger } from '@/core/logger'
import { handleMongoConsumerSQSMessage } from '@/lambdas/mongo-db-trigger-consumer/app'
import { MongoConsumerMessage } from '@/lambdas/mongo-db-trigger-consumer'

export const isClickhouseEnabledInRegion = () => {
  logger.info('Checking if clickhouse is enabled in region', {
    region: process.env.REGION,
    env: process.env.ENV,
  })
  return (
    envIs('local') ||
    envIs('test') ||
    envIs('dev') ||
    (envIs('sandbox') && process.env.REGION === 'asia-1')
  )
}

export const getClickhouseDbName = (tenantId: string) => {
  return sanitizeSqlName(
    envIs('test') ? `tarpon_test_${tenantId}` : `tarpon_${tenantId}`
  )
}

let client: Record<string, ClickHouseClient> = {}

export const closeClickhouseClient = async (tenantId: string) => {
  if (client[tenantId]) {
    await client[tenantId].close()
    delete client[tenantId]
  }
}

export const getClickhouseClientConfig = async (
  database: string
): Promise<NodeClickHouseClientConfigOptions> => {
  const config = await getSecret<NodeClickHouseClientConfigOptions>(
    'clickhouse'
  )

  return {
    ...config,
    database,
    url: useNormalLink()
      ? config.url?.toString().replace('vpce.', '')
      : config.url,
  }
}

export const executeClickhouseDefaultClientQuery = async (
  callback: (client: ClickHouseClient) => Promise<any>
) => {
  if (envIs('local') || envIs('test')) {
    const clickHouseClient = createClient({
      url: 'http://localhost:8123',
      username: 'default',
      database: 'default',
    })
    const result = await callback(clickHouseClient)
    await clickHouseClient.close()
    return result
  } else {
    const config = await getClickhouseClientConfig('default')
    const clickHouseClient = createClient(config)
    const result = await callback(clickHouseClient)
    await clickHouseClient.close()
    return result
  }
}

const useNormalLink = () => {
  if (envIs('local') || envIs('test') || envIs('dev')) {
    return true
  }

  if (process.env.MIGRATION_TYPE) {
    return true
  }

  return false
}

export async function getClickhouseClient(tenantId: string) {
  if (client[tenantId]) {
    return client[tenantId]
  }

  if (envIs('test')) {
    await executeClickhouseDefaultClientQuery(async (clickHouseClient) => {
      await clickHouseClient.query({
        query: `CREATE DATABASE IF NOT EXISTS ${getClickhouseDbName(tenantId)}`,
      })
    })
  }

  if (envIs('local') || envIs('test')) {
    const clickHouseClient = createClient({
      url: 'http://localhost:8123',
      username: 'default',
      database: getClickhouseDbName(tenantId),
    })

    client = { [tenantId]: clickHouseClient }

    return clickHouseClient
  }

  const config = await getClickhouseClientConfig(getClickhouseDbName(tenantId))

  client = {
    [tenantId]: createClient(config),
  }

  return client[tenantId]
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

  return sanitizeSqlName(`${tableName}_${projectionName}_v${version}_proj`)
}

function assertTableName(
  tableName: string,
  tenantId: string = getContext()?.tenantId as string
): ClickhouseTableDefinition {
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
  tenantId: string,
  table: string,
  values: object[],
  columns: InsertParams['columns']
) => {
  const client = await getClickhouseClient(tenantId)

  const CLICKHOUSE_SETTINGS: ClickHouseSettings = {
    wait_for_async_insert: envIs('test', 'local') ? 1 : 0,
    async_insert: envIs('test', 'local') ? 0 : 1,
  }

  const insert = async () => {
    logger.info('Inserting into clickhouse', { table })
    await client.insert({
      table,
      values,
      columns: columns,
      format: 'JSON',
      clickhouse_settings: CLICKHOUSE_SETTINGS,
    })
  }

  await backOff(insert, {
    numOfAttempts: 3,
    maxDelay: 10000,
    startingDelay: 1000,
    jitter: 'full',
    retry(e, attemptNumber) {
      logger.error(
        `Error inserting into clickhouse, retrying... ${attemptNumber}, Message: ${e.message}`,
        e
      )
      return true
    },
  })
}

export async function insertToClickhouse<T extends object>(
  tableName: TableName,
  object: T,
  tenantId: string = getContext()?.tenantId as string
) {
  if (!isClickhouseEnabledInRegion()) {
    return
  }

  const tableDefinition = assertTableName(tableName, tenantId)

  if (envIs('test')) {
    if (!isClickhouseEnabled()) {
      return
    } else {
      await createOrUpdateClickHouseTable(tenantId, tableDefinition)
    }
  }

  await clickhouseInsert(
    tenantId,
    tableName,
    [
      {
        id: object[tableDefinition.idColumn],
        data: JSON.stringify(object),
        is_deleted: 0,
      },
    ],
    ['id', 'data', 'is_deleted']
  )
}

export async function batchInsertToClickhouse(
  tenantId: string,
  table: TableName,
  objects: object[]
) {
  const tableDefinition = assertTableName(table, tenantId)
  logger.info('Starting batch insert to clickhouse')
  if (envIs('test')) {
    if (!isClickhouseEnabled()) {
      return
    } else {
      await createOrUpdateClickHouseTable(tenantId, tableDefinition)
    }
  }
  logger.info('Clickhouse is enabled, starting batch insert')
  await clickhouseInsert(
    tenantId,
    sanitizeSqlName(table),
    objects.map((object) => ({
      id: object[tableDefinition.idColumn],
      data: JSON.stringify(object),
      is_deleted: 0,
    })),
    ['id', 'data', 'is_deleted']
  )
}

export function isClickhouseEnabled() {
  return hasFeature('CLICKHOUSE_ENABLED') && isClickhouseEnabledInRegion()
}

export const executeClickhouseQuery = async <T extends object>(
  tenantId: string,
  query: string,
  params: Record<string, string>
): Promise<T[]> => {
  const client = await getClickhouseClient(tenantId)
  let formattedQuery = query
  for (const [key, value] of Object.entries(params)) {
    formattedQuery = formattedQuery.replace(
      new RegExp(`{{ ${key} }}`, 'g'),
      value
    )
  }

  const result = await client.query({
    query: `
    ${formattedQuery} SETTINGS output_format_json_quote_64bit_integers=0
    `,
    format: 'JSONEachRow',
  })
  return result.json<T>()
}

const getAllColumns = (table: ClickhouseTableDefinition) => [
  'id String',
  'data String',
  `timestamp UInt64 MATERIALIZED JSONExtractUInt(data, '${table.timestampColumn}')`,
  'is_deleted UInt8 DEFAULT 0',
  ...(table.mongoIdColumn
    ? ["mongo_id String MATERIALIZED JSONExtractString(data, '_id')"]
    : []),
  ...(table.materializedColumns || []),
]

export const getCreateTableQuery = (table: ClickhouseTableDefinition) => {
  const tableName = table.table
  const columns = getAllColumns(table)

  return `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.join(', ')}
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

const createDbIfNotExists = async (tenantId: string) => {
  await executeClickhouseDefaultClientQuery(async (client) => {
    await client.query({
      query: `CREATE DATABASE IF NOT EXISTS ${getClickhouseDbName(tenantId)}`,
    })
  })
}

export async function createTenantDatabase(tenantId: string) {
  await createDbIfNotExists(tenantId)

  for (const table of ClickHouseTables) {
    await createOrUpdateClickHouseTable(tenantId, table, {
      skipDefaultClient: true,
    })
  }
}

export async function createOrUpdateClickHouseTable(
  tenantId: string,
  table: ClickhouseTableDefinition,
  options?: { skipDefaultClient?: boolean }
) {
  const tableName = table.table
  if (!options?.skipDefaultClient) {
    await createDbIfNotExists(tenantId)
  }
  const client = await getClickhouseClient(tenantId)
  await createTableIfNotExists(client, tableName, table)
  await addMissingColumns(client, tableName, table)
  await addMissingProjections(client, tableName, table)
  await createMaterializedViews(client, table)
}

async function createTableIfNotExists(
  client: ClickHouseClient,
  tableName: string,
  table: ClickhouseTableDefinition
): Promise<void> {
  const tableExists = await checkTableExists(client, tableName)
  if (!tableExists) {
    const createTableQuery = getCreateTableQuery(table)
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

async function addMissingColumns(
  client: ClickHouseClient,
  tableName: string,
  table: ClickhouseTableDefinition
): Promise<void> {
  const existingColumns = await getExistingColumns(client, tableName)
  const columns = getAllColumns(table)
  for (const col of columns) {
    const { colName, colType, expr = '' } = parseColumnDefinition(col)
    const existingColumn = existingColumns.find((c) => c.name === colName)
    // remove unnecessare '\n' from colType and only keep a single whitespace

    if (!existingColumn) {
      await addColumn(client, tableName, colName, colType, expr)
      continue
    }

    const updatedColType = colType.split('DEFAULT')[0].trim()
    const existingColType = existingColumn.type
      .replace(/\s+/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim()

    if (existingColType !== updatedColType) {
      await updateColumn(client, tableName, colName, colType, expr)
    }
  }
}

async function getExistingColumns(client: ClickHouseClient, tableName: string) {
  const describeTableQuery = `DESCRIBE TABLE ${tableName}`
  const response: ResponseJSON<{
    name: string
    default_expression: string
    type: string
  }> = await (await client.query({ query: describeTableQuery })).json()
  return response.data
}

function parseColumnDefinition(col: string): {
  colName: string
  colType: string
  expr: string
} {
  const [colName, ...rest] = col.split(' ')
  const expr = rest.join(' ').split('MATERIALIZED ')[1]?.trim()
  const colType = rest.join(' ').split(' MATERIALIZED ')[0].trim()

  return {
    colName,
    colType,
    expr,
  }
}

async function addColumn(
  client: ClickHouseClient,
  tableName: string,
  colName: string,
  colType: string,
  expr?: string
): Promise<void> {
  const addColumnQuery = `
    ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType} ${
    expr ? 'MATERIALIZED ' + expr : ''
  }
  `
  await client.query({ query: addColumnQuery })
  logger.info(
    `Added missing materialized column ${colName} to table ${tableName}.`
  )
}

async function updateColumn(
  client: ClickHouseClient,
  tableName: string,
  colName: string,
  colType: string,
  expr?: string
): Promise<void> {
  const updateColumnQuery = `ALTER TABLE ${tableName} MODIFY COLUMN ${colName} ${colType} ${
    expr ? 'MATERIALIZED ' + expr : ''
  }`
  logger.info(`Updated materialized column ${colName} in table ${tableName}.`)
  await client.query({ query: updateColumnQuery })
}

async function addMissingProjections(
  client: ClickHouseClient,
  tableName: string,
  table: ClickhouseTableDefinition
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
  view: MaterializedViewDefinition
) => {
  return `
    CREATE TABLE IF NOT EXISTS ${view.table} (
      ${view.columns.join(', ')}
    ) ENGINE = ${view.engine}()
    ORDER BY ${view.orderBy}
    PRIMARY KEY ${view.primaryKey}
    ${view.partitionBy ? `PARTITION BY ${view.partitionBy}` : ''}
    SETTINGS index_granularity = 8192
  `
}

export const createMaterializedViewQuery = (
  view: MaterializedViewDefinition,
  tableName: string
) => {
  return `
    CREATE MATERIALIZED VIEW IF NOT EXISTS ${view.viewName} TO ${view.table}
    AS (
      SELECT ${view.columns.map((col) => col.split(' ')[0]).join(', ')}
      FROM ${tableName}
    )
  `
}

async function createMaterializedViews(
  client: ClickHouseClient,
  table: ClickhouseTableDefinition
): Promise<void> {
  if (!table.materializedViews?.length) {
    return
  }

  for (const view of table.materializedViews) {
    const createViewQuery = createMaterializedTableQuery(view)
    await client.query({ query: createViewQuery })
    const matQuery = createMaterializedViewQuery(view, table.table)
    await client.query({ query: matQuery })
  }
}

export function getSortedData<T>({
  data,
  sortField,
  sortOrder,
  groupByField,
  groupBySortField,
}: {
  data: T[]
  sortField: string
  sortOrder: 'ascend' | 'descend'
  groupByField: string
  groupBySortField: string
}): T[] {
  const items = chain(data)
    .groupBy(groupByField)
    .map((group) => maxBy(group, groupBySortField))
    .value() as T[]
  const sortDirection = sortOrder === 'ascend' ? 1 : -1
  const sortedItems = items.sort(
    (a, b) => sortDirection * (a[sortField] - b[sortField])
  )
  return sortedItems
}

export const sanitizeSqlName = (tableName: string) =>
  tableName.replace(/-/g, '_')

const sqs = new SQS({ region: process.env.AWS_REGION })

export const sendMessageToMongoConsumer = async (
  message: MongoConsumerMessage
) => {
  if (envIs('test') && !hasFeature('CLICKHOUSE_ENABLED')) {
    return
  }

  if (envIs('local') || envIs('test')) {
    await handleMongoConsumerSQSMessage([message])
    return
  }

  await sqs.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify(message),
      QueueUrl: process.env.MONGO_DB_CONSUMER_QUEUE_URL,
    })
  )
}
