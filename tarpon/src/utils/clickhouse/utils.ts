import {
  ClickHouseClient,
  ClickHouseSettings,
  createClient,
  InsertParams,
  ResponseJSON,
} from '@clickhouse/client'
import { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config'
import { chain, get, maxBy, memoize } from 'lodash'
import { backOff, BackoffOptions } from 'exponential-backoff'
import { SendMessageCommand, SQS } from '@aws-sdk/client-sqs'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils/env'
import { ConnectionCredentials } from 'thunder-schema'
import { envIs, envIsNot } from '../env'
import { bulkSendMessages } from '../sns-sqs-client'
import {
  ClickHouseTables,
  MaterializedViewDefinition,
  ProjectionsDefinition,
  ClickhouseTableDefinition,
  TableName,
  IndexType,
  IndexOptions,
} from './definition'
import {
  DATE_TIME_FORMAT_JS,
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
} from '@/core/constants'
import { hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { getSecret } from '@/utils/secrets-manager'
import { logger } from '@/core/logger'
import { handleMongoConsumerSQSMessage } from '@/lambdas/mongo-db-trigger-consumer/app'
import { MongoConsumerMessage } from '@/lambdas/mongo-db-trigger-consumer'
import { addNewSubsegment } from '@/core/xray'
import { DynamoConsumerMessage } from '@/lambdas/dynamo-db-trigger-consumer'

export const isClickhouseEnabledInRegion = () => {
  if (envIsNot('prod')) {
    return true
  }

  const [stage, region] = stageAndRegion()

  const config = getTarponConfig(stage, region)
  return !!config.clickhouse
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

const getUrl = (config: NodeClickHouseClientConfigOptions) => {
  if (useNormalLink()) {
    return config.url?.toString().replace('vpce.', '')
  }
  return config.url
}

const getLocalConfig = (
  database: string
): NodeClickHouseClientConfigOptions => ({
  url: 'http://localhost:8123',
  username: 'default',
  password: '',
  database,
})

export const getClickhouseClientConfig = async (
  database: string
): Promise<NodeClickHouseClientConfigOptions> => {
  if (envIs('local') || envIs('test')) {
    return getLocalConfig(database)
  }

  const config = await getSecret<NodeClickHouseClientConfigOptions>(
    'clickhouse'
  )

  return {
    ...config,
    database,
    url: getUrl(config),
    clickhouse_settings: {
      ...config.clickhouse_settings,
      alter_sync: '2',
      mutations_sync: '2',
    },
  }
}

const createAndExecuteWithClient = async <T>(
  config: NodeClickHouseClientConfigOptions,
  callback: (client: ClickHouseClient) => Promise<T>
): Promise<T> => {
  const clickHouseClient = createClient(config)
  const result = await callback(clickHouseClient)
  await clickHouseClient.close()
  return result
}

export const executeClickhouseDefaultClientQuery = async <T>(
  callback: (client: ClickHouseClient) => Promise<T>
) => {
  if (envIs('local') || envIs('test')) {
    return createAndExecuteWithClient(getLocalConfig('default'), callback)
  }

  const config = await getClickhouseClientConfig('default')
  return createAndExecuteWithClient(config, callback)
}

const useNormalLink = () => {
  if (envIs('local', 'test', 'dev') || process.env.MIGRATION_TYPE) {
    return true
  }
  return false
}

const getConnectionCredentials = (
  config: NodeClickHouseClientConfigOptions,
  database: string
): ConnectionCredentials => ({
  url: config.url?.toString() ?? '',
  username: config.username,
  password: config.password,
  database,
})

export async function getClickhouseCredentials(
  tenantId: string
): Promise<ConnectionCredentials> {
  const dbName = getClickhouseDbName(tenantId)
  const config = await getClickhouseClientConfig(dbName)

  if (!config.url) {
    throw new Error('Clickhouse URL is not set')
  }

  return getConnectionCredentials(config, dbName)
}

export async function getClickhouseDefaultCredentials(): Promise<ConnectionCredentials> {
  const config = await getClickhouseClientConfig('default')
  return getConnectionCredentials(config, 'default')
}

export async function getDefualtConfig(): Promise<ConnectionCredentials> {
  const config = await getClickhouseClientConfig('default')
  return getConnectionCredentials(config, 'default')
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

  const config = await getClickhouseClientConfig(getClickhouseDbName(tenantId))
  client = { [tenantId]: createClient(config) }
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

  const options: BackoffOptions = {
    numOfAttempts: 10,
    maxDelay: 240000,
    startingDelay: 10000,
    timeMultiple: 2,
  }

  await backOff(
    async () => {
      await client.insert({
        table,
        values,
        columns: columns,
        format: 'JSON',
        clickhouse_settings: CLICKHOUSE_SETTINGS,
      })
    },
    {
      ...options,
      retry: (error, attemptNumber) => {
        logger.warn(
          `ClickHouse insert failed, retrying... Attempt ${attemptNumber}: ${error.message}`
        )
        return true
      },
    }
  )
}

const testCache = new Set()

export async function prepareClickhouseInsert(
  tableName: TableName,
  tenantId: string
) {
  if (!isClickhouseEnabledInRegion()) {
    return false
  }

  const tableDefinition = assertTableName(tableName, tenantId)
  const cacheKey = `${tenantId}-${tableName}`

  if (envIs('test')) {
    if (!isClickhouseEnabled()) {
      return false
    }
    if (!testCache.has(cacheKey)) {
      await createOrUpdateClickHouseTable(tenantId, tableDefinition)
      testCache.add(cacheKey)
    }
  }

  return tableDefinition
}

export async function batchInsertToClickhouse(
  tenantId: string,
  table: TableName,
  objects: object[]
) {
  const tableDefinition = await prepareClickhouseInsert(table, tenantId)
  if (!tableDefinition) {
    return
  }

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

export function isClickhouseMigrationEnabled() {
  return isClickhouseEnabledInRegion() && hasFeature('CLICKHOUSE_MIGRATION')
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
  const indexOptions = createIndexOptions(table)
  return `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.join(', ')}
      ${indexOptions.length ? `, ${indexOptions.join(',\n      ')}` : ''}
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
  await addMissingColumnsTable(client, tableName, table)
  await addMissingProjections(client, tableName, table)
  await addMissingIndexes(client, tableName, table, tenantId)
  await createMaterializedViews(client, table, tenantId)
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
  columns: string[]
): Promise<void> {
  const existingColumns = await getExistingColumns(client, tableName)
  const columnsToAdd: string[] = []
  const columnsToUpdate: string[] = []

  for (const col of columns) {
    const { colName, colType, expr = '' } = parseColumnDefinition(col)
    const existingColumn = existingColumns.find((c) => c.name === colName)

    if (!existingColumn) {
      columnsToAdd.push(
        `${colName} ${colType} ${expr ? 'MATERIALIZED ' + expr : ''}`
      )
      continue
    }

    const updatedColType = colType
      .split('DEFAULT')[0]
      .replace(/\s+/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim()
      .split(' MATERIALIZED ')[0]
    const existingColType = existingColumn.type
      .replace(/\s+/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim()

    if (existingColType !== updatedColType) {
      columnsToUpdate.push(
        `${colName} ${colType} ${expr ? 'MATERIALIZED ' + expr : ''}`
      )
    }
  }

  if (columnsToAdd.length > 0) {
    const addColumnsQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnsToAdd.join(
      ', ADD COLUMN '
    )}`

    await client.query({ query: addColumnsQuery })
    logger.info(
      `Added missing columns to table ${tableName}. ${columnsToAdd
        .map((c) => c.split(' ')[0])
        .join(', ')}`
    )
  }

  if (columnsToUpdate.length > 0) {
    const updateColumnsQuery = `ALTER TABLE ${tableName} MODIFY COLUMN ${columnsToUpdate.join(
      ', MODIFY COLUMN '
    )}`
    await client.query({ query: updateColumnsQuery })
    logger.info(
      `Updated columns to table ${tableName}. ${columnsToUpdate
        .map((c) => c.split(' ')[0])
        .join(', ')}`
    )
  }
}
async function addMissingColumnsTable(
  client: ClickHouseClient,
  tableName: string,
  table: ClickhouseTableDefinition
): Promise<void> {
  const columns = getAllColumns(table)
  await addMissingColumns(client, tableName, columns)
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
  const [colName, ...rest] = col.trim().split(' ')
  const expr = rest.join(' ').split('MATERIALIZED ')[1]?.trim()
  const colType = rest.join(' ').split(' MATERIALIZED ')[0].trim()

  return {
    colName,
    colType,
    expr,
  }
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

export const createMaterializedViewQuery = async (
  view: MaterializedViewDefinition,
  tableName: string,
  tenantId?: string
) => {
  return `
    CREATE MATERIALIZED VIEW IF NOT EXISTS ${view.viewName} TO ${view.table}
    AS ${
      typeof view.query === 'function'
        ? await view.query(tenantId ?? '')
        : view.query ||
          `(
          SELECT ${view.columns
            ?.filter((col) => !col.includes(' MATERIALIZED '))
            ?.map((col) => col.split(' ')[0])
            ?.join(', ')}
          FROM ${tableName}
        )`
    }
  `
}

const listAllTables = memoize(async (client: ClickHouseClient) => {
  const listAllTables = await client.query({
    query: `SHOW TABLES`,
  })
  const allTables = await listAllTables.json<{
    name: string
  }>()
  return allTables.data
})

async function createMaterializedViews(
  client: ClickHouseClient,
  table: ClickhouseTableDefinition,
  tenantId?: string
): Promise<void> {
  if (!table.materializedViews?.length) {
    return
  }
  const allTables = await listAllTables(client)
  for (const view of table.materializedViews) {
    const isViewExists = allTables.some((t) => t.name === view.table)
    if (isViewExists) {
      // To save some time, we skip the view if it already exists please create a new migration if there are any changes to the view
      continue
    }
    const createViewQuery = createMaterializedTableQuery(view)
    await client.query({ query: createViewQuery })
    const matQuery = await createMaterializedViewQuery(
      view,
      table.table,
      tenantId
    )
    await client.query({ query: matQuery })

    await addMissingColumns(client, view.table, view.columns)
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
    (a, b) => sortDirection * (get(a, sortField) - get(b, sortField))
  )
  return sortedItems
}

export const sanitizeSqlName = (tableName: string) =>
  tableName.replace(/[^0-9a-zA-Z]/g, '_')

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

// send bulk messages to mongo consumer
export async function sendBulkMessagesToMongoConsumer(
  messages: MongoConsumerMessage[]
) {
  if (envIs('test') && !hasFeature('CLICKHOUSE_ENABLED')) {
    return
  }
  if (envIs('local') || envIs('test')) {
    await handleMongoConsumerSQSMessage(messages)
    return
  }
  await bulkSendMessages(
    sqs,
    process.env.MONGO_DB_CONSUMER_QUEUE_URL as string,
    messages.map((message) => ({
      MessageBody: JSON.stringify(message),
    }))
  )
}

export async function sendMessageToDynamoDbConsumer(
  message: DynamoConsumerMessage
) {
  if (envIs('test') && !hasFeature('CLICKHOUSE_MIGRATION')) {
    return
  }
  if (envIs('local') || envIs('test')) {
    // Direct processing for local/test environments
    const { dynamoDbTriggerQueueConsumerHandler } = await import(
      '@/lambdas/dynamo-db-trigger-consumer/app'
    )
    await dynamoDbTriggerQueueConsumerHandler({
      Records: [
        {
          body: JSON.stringify(message),
        },
      ],
    })
    return
  }
  logger.debug('Sending message to DynamoDb consumer', {
    message,
  })
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.DYNAMO_DB_CONSUMER_QUEUE_URL,
      MessageBody: JSON.stringify(message),
    })
  )
}

async function addMissingIndexes(
  client: ClickHouseClient,
  tableName: string,
  table: ClickhouseTableDefinition,
  tenantId: string
): Promise<void> {
  const indexOptions = createIndexOptions(table)
  if (!indexOptions.length) {
    return
  }
  const existingIndexes = await getExistingIndexes(client, tableName, tenantId)
  for (const indexDef of indexOptions) {
    const [_, indexName, ...rest] = indexDef.split(' ')
    const indexDefinition = rest.join(' ')

    const existingIndex = existingIndexes.find((idx) => idx.name === indexName)

    if (!existingIndex) {
      await addIndex(client, tableName, indexName, indexDefinition)
      continue
    }

    const finalOptions: IndexOptions = {
      type: existingIndex.type,
      config: {
        granularity: existingIndex?.granularity ?? 1,
      },
    }
    const normalizedExistingDef = getIndexDefinition(
      existingIndex.expr,
      existingIndex.type,
      finalOptions
    )
      .replace(/\s+/g, ' ')
      .trim()
    const normalizedNewDef = indexDefinition.replace(/\s+/g, ' ').trim()

    if (normalizedExistingDef !== normalizedNewDef) {
      await updateIndex(client, tableName, indexName, indexDefinition)
    }
  }
}

type Index = {
  name: string
  expr: string
  type: IndexType | string
  granularity: number
}

async function getExistingIndexes(
  client: ClickHouseClient,
  tableName: string,
  tenantId: string
): Promise<Index[]> {
  const response = await client.query({
    query: `SELECT name, expr, type_full as type, granularity FROM system.data_skipping_indices WHERE table = '${tableName}' AND database='${getClickhouseDbName(
      tenantId
    )}'`,
  })
  const result = await response.json()
  if (!result.data || !result.data.length) {
    return []
  }
  return result.data as Array<{
    name: string
    expr: string
    type: string
    granularity: number
  }>
}

async function addIndex(
  client: ClickHouseClient,
  tableName: string,
  indexName: string,
  indexDefinition: string
): Promise<void> {
  const addIndexQuery = `ALTER TABLE ${tableName} ADD INDEX ${indexName} ${indexDefinition}`
  await client.query({ query: addIndexQuery })
  logger.info(`Added missing index ${indexName} to table ${tableName}.`)
}

async function updateIndex(
  client: ClickHouseClient,
  tableName: string,
  indexName: string,
  indexDefinition: string
): Promise<void> {
  await client.query({
    query: `ALTER TABLE ${tableName} DROP INDEX ${indexName}`,
  })
  await client.query({
    query: `ALTER TABLE ${tableName} ADD INDEX ${indexName} ${indexDefinition}`,
  })
  logger.info(`Updated index ${indexName} in table ${tableName}.`)
}

function getIndexDefinition(
  columnName: string,
  indexType: IndexType | string,
  options: IndexOptions
): string {
  switch (indexType) {
    case 'inverted':
      return `(${columnName}) TYPE ${options.type}(${options.config.granularity})`
    case 'bloom_filter':
      return `(${columnName}) TYPE bloom_filter(${options.config.granularity})`
    case 'minmax':
      return `(${columnName}) TYPE minmax GRANULARITY ${options.config.granularity}`
    case 'set':
      return `(${columnName}) TYPE set(${options.config.granularity})`
    case 'tokenbf_v1':
      return `(${columnName}) TYPE tokenbf_v1(${options.config.bloomFilterSize}, ${options.config.numHashFunctions}, ${options.config.randomSeed}) GRANULARITY ${options.config.granularity}`
    default:
      return `(${columnName}) TYPE ${options.type} GRANULARITY ${options.config.granularity}`
  }
}

function createIndexOptions(tableDefinition: ClickhouseTableDefinition) {
  if (!tableDefinition.indexes) {
    return []
  }
  const indexOptions: string[] = []
  for (const index of tableDefinition.indexes) {
    const finalOptions: IndexOptions = {
      type: index.type,
      config: {
        ...index.options,
      },
    }
    const indexDefinition = getIndexDefinition(
      index.column,
      index.type,
      finalOptions
    )
    indexOptions.push(`INDEX ${index.name} ${indexDefinition}`)
  }
  return indexOptions
}

type TimeFormat = {
  timestampFormat: string
  clickhouseTimeMethod: string
  dateFormatJs: string
}

export const getTimeformatsByGranularity = (
  granularity: 'HOUR' | 'DAY' | 'MONTH'
): TimeFormat => {
  switch (granularity) {
    case 'HOUR':
      return {
        timestampFormat: DATE_TIME_FORMAT_JS,
        clickhouseTimeMethod: 'toStartOfHour',
        dateFormatJs: HOUR_DATE_FORMAT_JS,
      }
    case 'DAY':
      return {
        timestampFormat: DATE_TIME_FORMAT_JS,
        clickhouseTimeMethod: 'toStartOfDay',
        dateFormatJs: DAY_DATE_FORMAT_JS,
      }
    case 'MONTH':
      return {
        timestampFormat: DAY_DATE_FORMAT_JS,
        clickhouseTimeMethod: 'toStartOfMonth',
        dateFormatJs: MONTH_DATE_FORMAT_JS,
      }
  }
}

/**
 * Safely executes a Clickhouse query with error handling
 * @param clientOrTenantId Either a Clickhouse client instance or tenant ID string
 * @param queryOrParams Query string or query parameters object
 * @param options Optional configuration
 * @returns Query result or null on error (if throwOnError is false)
 */
export async function executeClickhouseQuery<T extends object>(
  clientOrTenantId: ClickHouseClient | string,
  queryOrParams: string | Parameters<ClickHouseClient['query']>[0],
  params: Record<string, any> = {},
  options: { throwOnError?: boolean; logError?: boolean } = {
    throwOnError: false,
    logError: true,
  }
): Promise<T> {
  const [segment, segment2] = await Promise.all([
    addNewSubsegment('Query time for clickhouse', 'Query'),
    addNewSubsegment('Query time for clickhouse', 'Overall'),
  ])
  const start = Date.now()
  let client: ClickHouseClient
  let queryParams: Parameters<ClickHouseClient['query']>[0]
  if (typeof queryOrParams === 'string') {
    let formattedQuery = queryOrParams
    for (const [key, value] of Object.entries(params)) {
      formattedQuery = formattedQuery.replace(
        new RegExp(`{{ ${key} }}`, 'g'),
        value
      )
    }
    queryParams = {
      query: `${formattedQuery} SETTINGS output_format_json_quote_64bit_integers=0`,
      format: 'JSONEachRow',
    }
  } else {
    queryParams = queryOrParams
  }

  try {
    if (typeof clientOrTenantId === 'string') {
      client = await getClickhouseClient(clientOrTenantId)
    } else {
      client = clientOrTenantId
    }
    logger.info('Running clickhouse query', { query: queryParams.query })

    const result = await client.query(queryParams)
    const end = Date.now()

    const clickHouseSummary = result.response_headers['x-clickhouse-summary']
      ? JSON.parse(result.response_headers['x-clickhouse-summary'] as string)
      : {}

    const clickhouseQueryExecutionTime = clickHouseSummary['elapsed_ns']
      ? clickHouseSummary['elapsed_ns'] / 1000000
      : 0

    const queryTimeData = {
      ...clickHouseSummary,
      networkLatency: `${end - start - clickhouseQueryExecutionTime}ms`,
      clickhouseQueryExecutionTime: `${clickhouseQueryExecutionTime}ms`,
      totalLatency: `${end - start}ms`,
    }

    logger.info('Query time data', queryTimeData)
    segment?.addMetadata('Query time data', queryTimeData)
    segment?.close()
    const jsonResult = await result.json()
    const end2 = Date.now()

    const overallStats = {
      ...clickHouseSummary,
      overallTime: `${end2 - start}ms`,
      networkLatency: `${end - start - clickhouseQueryExecutionTime}ms`,
      systemLatency: `${end2 - end}ms`,
      clickhouseQueryExecutionTime: `${clickhouseQueryExecutionTime}ms`,
    }

    segment2?.addMetadata('Overall stats', overallStats)
    segment2?.close()

    logger.info('Overall stats', overallStats)

    return jsonResult as T
  } catch (error) {
    if (options.logError) {
      logger.error('Error executing Clickhouse query', {
        query: queryParams.query,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        executionTime: `${Date.now() - start}ms`,
      })
    }

    if (envIs('local')) {
      throw error
    }

    if (options.throwOnError) {
      throw error
    } else {
      throw new Error('Failed to fetch data')
    }
  } finally {
    segment?.close()
    segment2?.close()
  }
}

export const runExecClickhouseQuery = async (
  tenantId: string,
  data: { query: string }
) => {
  const client = await getClickhouseClient(tenantId)
  await client.exec({
    query: data.query,
  })
}
