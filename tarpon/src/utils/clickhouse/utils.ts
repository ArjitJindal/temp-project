import { ClickHouseClient, ResponseJSON } from '@clickhouse/client'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { JsonMigrationService } from 'thunder-schema'
import get from 'lodash/get'
import maxBy from 'lodash/maxBy'
import memoize from 'lodash/memoize'
import map from 'lodash/map'
import groupBy from 'lodash/groupBy'
import { bulkSendMessages, getSQSClient } from '../sns-sqs-client'
import { envIs } from '../env'
import { generateColumnsFromModel } from './model-schema-parser'
import {
  getClickhouseClient,
  getClickhouseCredentials,
  getClickhouseDefaultCredentials,
} from './client'
import { sanitizeSqlName } from './sanitize'
import { getClickhouseDbName } from './database-utils'
import { executeClickhouseDefaultClientQuery } from './execute'
import { executeWithBackoff } from './executeWithBackoff'
import {
  MaterializedViewDefinition,
  ProjectionsDefinition,
  ClickhouseTableDefinition,
  IndexType,
  IndexOptions,
} from '@/@types/clickhouse'
import {
  DATE_TIME_FORMAT_JS,
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
} from '@/core/constants'
import { hasFeature } from '@/core/utils/context'
import { logger } from '@/core/logger'
import { MongoConsumerMessage } from '@/@types/mongo'
import { MigrationTrackerTable } from '@/models/migration-tracker'

const getProjectionName = (
  tableName: string,
  projection: ProjectionsDefinition
) => {
  const projectionName = projection.name
  const version = projection.version

  return sanitizeSqlName(`${tableName}_${projectionName}_v${version}_proj`)
}
export default getProjectionName

const getAllColumns = (table: ClickhouseTableDefinition) => {
  // If model is specified, generate columns from the model
  if (table.model) {
    try {
      const modelColumns = generateColumnsFromModel(table.model)
      return [
        'id String',
        'is_deleted UInt8 DEFAULT 0',
        ...modelColumns.map((col) => {
          // ClickHouse doesn't support Nullable(JSON), so handle this case
          if (col.nullable && col.type === 'JSON') {
            return `${col.name} JSON`
          }
          return col.nullable
            ? `${col.name} Nullable(${col.type})`
            : `${col.name} ${col.type}`
        }),
        ...(table.materializedColumns || []),
      ]
    } catch (error) {
      logger.error(
        `Failed to generate columns from model ${table.model}:`,
        error
      )
    }
  }
  return [
    'id String',
    'data String',
    `timestamp UInt64 MATERIALIZED JSONExtractUInt(data, '${table.timestampColumn}')`,
    'is_deleted UInt8 DEFAULT 0',
    ...(table.mongoIdColumn
      ? ["mongo_id String MATERIALIZED JSONExtractString(data, '_id')"]
      : []),
    ...(table.materializedColumns || []),
  ]
}

export const getCreateTableQuery = (table: ClickhouseTableDefinition) => {
  const tableName = table.table
  const columns = getAllColumns(table)
  const indexOptions = createIndexOptions(table)

  // Handle ReplacingMergeTree with version column
  const engineClause =
    table.engine === 'ReplacingMergeTree' && table.versionColumn
      ? `${table.engine}(${table.versionColumn})`
      : table.engine

  return `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.join(', ')}
      ${indexOptions.length ? `, ${indexOptions.join(',\n      ')}` : ''}
    ) ENGINE = ${engineClause}
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
    SETTINGS index_granularity = 8192, enable_json_type = 1
  `
}

export async function syncThunderSchemaTables(tenantId: string) {
  const defaultConfig = await getClickhouseDefaultCredentials()
  const clickhouseCredentials = await getClickhouseCredentials(tenantId)
  const jsonMigrationService = new JsonMigrationService(clickhouseCredentials)
  const migrationTracker = new MigrationTrackerTable({
    credentials: defaultConfig,
  }).objects

  for await (const migration of migrationTracker) {
    const fileName = migration.id
    const migrationData = JSON.parse(migration.data)
    await jsonMigrationService.migrate(`${fileName}.ts`, migrationData)
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
  const client = await getClickhouseClient(tenantId, {
    alter_sync: '2',
    mutations_sync: '2',
  })
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

    await executeWithBackoff(
      async () => {
        await client.query({ query: createTableQuery })
      },
      'create table',
      { tableName }
    )
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

    await executeWithBackoff(
      async () => {
        await client.query({ query: addColumnsQuery })
      },
      'add columns',
      { tableName }
    )
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

    await executeWithBackoff(
      async () => {
        await client.query({ query: updateColumnsQuery })
      },
      'update columns',
      { tableName }
    )
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
  await executeWithBackoff(
    async () => {
      await client.query({ query: addProjectionQuery })
    },
    'add projection',
    { tableName }
  )
  await executeWithBackoff(
    async () => {
      await client.query({
        query: `ALTER TABLE ${tableName} MATERIALIZE PROJECTION ${projectionName}`,
      })
    },
    'materialize projection',
    { tableName }
  )
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
    SETTINGS index_granularity = 8192, enable_json_type = 1
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
    await executeWithBackoff(
      async () => {
        await client.query({ query: createViewQuery })
      },
      'create materialized table',
      { table: table.table, tenantId }
    )
    const matQuery = await createMaterializedViewQuery(
      view,
      table.table,
      tenantId
    )
    await executeWithBackoff(
      async () => {
        await client.query({ query: matQuery })
      },
      'create materialized view',
      { table: table.table, tenantId }
    )

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
  const items = map(groupBy(data, groupByField), (group) =>
    maxBy(group, groupBySortField)
  ) as T[]
  const sortDirection = sortOrder === 'ascend' ? 1 : -1
  const sortedItems = items.sort(
    (a, b) => sortDirection * (get(a, sortField) - get(b, sortField))
  )
  return sortedItems
}

const sqs = getSQSClient()

export const sendMessageToMongoConsumer = async (
  message: MongoConsumerMessage
) => {
  if (process.env.DISABLE_MONGO_CONSUMER === '1') {
    return
  }

  if (envIs('test') && !hasFeature('CLICKHOUSE_ENABLED')) {
    return
  }

  if (envIs('local') || envIs('test')) {
    const { handleLocalMongoDbTrigger } = await import(
      '@/core/local-handlers/mongo-db-trigger-consumer'
    )

    await handleLocalMongoDbTrigger([message])
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
  if (process.env.DISABLE_MONGO_CONSUMER === '1') {
    console.log('Skipping bulk message to MongoDb consumer')
    return
  }

  if (envIs('test') && !hasFeature('CLICKHOUSE_ENABLED')) {
    return
  }

  if (envIs('local') || envIs('test')) {
    const { handleLocalMongoDbTrigger } = await import(
      '@/core/local-handlers/mongo-db-trigger-consumer'
    )

    await handleLocalMongoDbTrigger(messages)
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
  await executeWithBackoff(
    async () => {
      await client.query({ query: addIndexQuery })
    },
    'add index',
    { tableName }
  )
  logger.info(`Added missing index ${indexName} to table ${tableName}.`)
}

async function updateIndex(
  client: ClickHouseClient,
  tableName: string,
  indexName: string,
  indexDefinition: string
): Promise<void> {
  await executeWithBackoff(
    async () => {
      await client.query({
        query: `ALTER TABLE ${tableName} DROP INDEX ${indexName}`,
      })
    },
    'drop index',
    { tableName }
  )
  await executeWithBackoff(
    async () => {
      await client.query({
        query: `ALTER TABLE ${tableName} ADD INDEX ${indexName} ${indexDefinition}`,
      })
    },
    'update index',
    { tableName }
  )
  await executeWithBackoff(
    async () => {
      await client.query({
        query: `ALTER TABLE ${tableName} DROP INDEX ${indexName} ${indexDefinition}`,
      })
    },
    'drop index',
    { tableName }
  )
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

export const runExecClickhouseQuery = async (
  tenantId: string,
  data: { query: string }
) => {
  const client = await getClickhouseClient(tenantId)
  await client.exec({
    query: data.query,
  })
}

export const createDbIfNotExists = async (tenantId: string) => {
  await executeClickhouseDefaultClientQuery(async (client) => {
    await client.query({
      query: `CREATE DATABASE IF NOT EXISTS ${getClickhouseDbName(tenantId)}`,
    })
  })
}
