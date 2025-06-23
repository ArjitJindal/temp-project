import { compact, omit } from 'lodash'
import { Document, WithId } from 'mongodb'
import { logger } from '../logger'
import { getCases } from './data/cases'
import { getCrmRecords, getCrmUserRecordLinks } from './data/crm-records'
import { auditlogs } from './data/auditlogs'
import {
  CLICKHOUSE_DEFINITIONS,
  CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO,
  ClickhouseTableDefinition,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import {
  batchInsertToClickhouse,
  createTenantDatabase,
  isClickhouseEnabledInRegion,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'
import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

type TableName = keyof typeof CLICKHOUSE_DEFINITIONS

type TableSyncer = {
  table: TableName
  sync: (
    tableName: TableName,
    table: ClickhouseTableDefinition
  ) => Promise<void>
}

export const seedClickhouse = async (tenantId: string) => {
  const client = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const db = client.db()

  if (isClickhouseEnabledInRegion()) {
    const clickhouseClient = await getClickhouseClient(tenantId)

    const promises = ClickHouseTables.map(async (table) => {
      try {
        await clickhouseClient.exec({
          query: `DELETE FROM ${table.table} WHERE 1=1`,
        })
      } catch (error) {
        // error code 60 is returned when the table does not exist
        // error code 81 is returned when the database does not exist
        if (
          error instanceof Error &&
          'code' in error &&
          (error.code == 60 || error.code == 81)
        ) {
          logger.warn(`Table ${table.table} does not exist`)
        } else {
          logger.warn(`Failed to delete from table ${table.table}: ${error}`)
          throw error
        }
      }
    })
    await Promise.all(promises)
    const mongoConsumerService = new MongoDbConsumer(client, dynamoDb)
    await createTenantDatabase(tenantId)
    await Promise.all(
      ClickHouseTables.map(async (table) => {
        const clickhouseTable = table.table
        // clear everything clickhouse table
        const mongoTable = CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO()[table.table]
        const mongoCollectionName = `${tenantId}-${mongoTable}`
        const data = db.collection(mongoCollectionName).find().batchSize(100)
        let dataArray: WithId<Document>[] = []
        for await (const dataChunk of data) {
          dataArray.push(dataChunk)
          if (dataArray.length === 100) {
            const updatedData = await mongoConsumerService.updateInsertMessages(
              mongoTable,
              dataArray
            )
            await batchInsertToClickhouse(
              tenantId,
              clickhouseTable,
              updatedData
            )
            dataArray = []
          }
        }
        if (dataArray.length > 0) {
          const updatedData = await mongoConsumerService.updateInsertMessages(
            mongoTable,
            dataArray
          )

          await batchInsertToClickhouse(tenantId, clickhouseTable, updatedData)
        }
      })
    )
  }
  const tableSyncers: TableSyncer[] = [
    {
      table: 'ALERTS',
      sync: async (_: TableName, table: ClickhouseTableDefinition) => {
        const data = getCases()
        const alerts = data
          .map((c) =>
            c.alerts?.map((a) => ({
              ...a,
              caseStatus: c.caseStatus,
            }))
          )
          .flatMap((a) => a)

        await batchInsertToClickhouse(tenantId, table.table, compact(alerts))
      },
    },
    {
      table: 'CASES_V2',
      sync: async (_: TableName, table: ClickhouseTableDefinition) => {
        const data = getCases()
        const cases = data.map((c) => omit(c, 'alerts', 'comments'))
        await batchInsertToClickhouse(tenantId, table.table, compact(cases))
      },
    },
    {
      table: 'CRM_RECORDS',
      sync: async (tableName: TableName, table: ClickhouseTableDefinition) => {
        const data = getCrmRecords()
        await batchInsertToClickhouse(tenantId, table.table, data)
      },
    },
    {
      table: 'CRM_USER_RECORD_LINK',
      sync: async (_: TableName, table: ClickhouseTableDefinition) => {
        const data = getCrmUserRecordLinks()
        await batchInsertToClickhouse(tenantId, table.table, data)
      },
    },
    {
      table: 'AUDIT_LOGS',
      sync: async (_: TableName, table: ClickhouseTableDefinition) => {
        const data = auditlogs()
        await batchInsertToClickhouse(tenantId, table.table, data)
      },
    },
  ]

  for (const tableSyncer of tableSyncers) {
    await tableSyncer.sync(
      tableSyncer.table,
      ClickHouseTables.find(
        (t) => t.table === CLICKHOUSE_DEFINITIONS[tableSyncer.table].tableName
      ) as ClickhouseTableDefinition
    )
  }
}
