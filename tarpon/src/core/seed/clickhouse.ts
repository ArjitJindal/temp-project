import { compact } from 'lodash'
import { Document, WithId } from 'mongodb'
import { getCases } from './data/cases'
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
} from '@/utils/clickhouse/utils'
import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import { getMongoDbClient } from '@/utils/mongodb-utils'

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
  const db = client.db()

  if (isClickhouseEnabledInRegion()) {
    const mongoConsumerService = new MongoDbConsumer(client)
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
      sync: async (tableName: TableName, table: ClickhouseTableDefinition) => {
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
