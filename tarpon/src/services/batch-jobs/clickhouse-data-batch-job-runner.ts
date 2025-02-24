import { BatchJobRunner } from './batch-job-runner-base'
import { ClickhouseDataBackfillBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO,
  ClickhouseTableNames,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { insertToClickhouse } from '@/utils/clickhouse/utils'

const mongoTableName = 'clickhouse-backfill'

type ClickhouseBackfillTable = {
  tableName: ClickhouseTableNames
  lastTimestamp: number
  isCompleted?: boolean
}

type ClickhouseBackfillItem = {
  tenantId: string
  referenceId: string
  tablesToBackfill: ClickhouseBackfillTable[]
  fromTimestamp: number
  toTimestamp: number
}

export class ClickhouseDataBatchJobRunner extends BatchJobRunner {
  protected async run(job: ClickhouseDataBackfillBatchJob): Promise<void> {
    const { tenantId, parameters } = job
    const {
      tableNames,
      fromTimestamp = 0,
      toTimestamp = Number.MAX_SAFE_INTEGER,
    } = parameters
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()
    const collection = db.collection<ClickhouseBackfillItem>(mongoTableName)

    const referenceId = parameters.referenceId

    let referenceItem: ClickhouseBackfillItem | null = await collection.findOne(
      { tenantId, referenceId }
    )

    if (!referenceItem) {
      const data: ClickhouseBackfillItem = {
        tenantId,
        referenceId,
        tablesToBackfill: [],
        fromTimestamp,
        toTimestamp,
      }
      await collection.insertOne(data)
      referenceItem = data
    }

    for (const table of tableNames) {
      // is table in the referenceItem?
      const tableItem = referenceItem?.tablesToBackfill.find(
        (t) => t.tableName === table
      )

      const tableDefinition = ClickHouseTables.find((t) => t.table === table)

      if (!tableDefinition) {
        throw new Error(`Table definition not found: ${table}`)
      }

      const mongoCollectionReference =
        CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO()[table]

      const mongoCollectionName = `${tenantId}-${mongoCollectionReference}`

      const mongoCollection =
        db.collection<ClickhouseBackfillTable>(mongoCollectionName)
      const timestampColumn = tableDefinition.timestampColumn

      const allItems = mongoCollection
        .find({
          [timestampColumn]: {
            $gte: Math.max(fromTimestamp, tableItem?.lastTimestamp ?? 0),
            $lte: toTimestamp,
          },
        })
        .sort({ [timestampColumn]: 1 })

      const batchSize = 1000
      let batch: object[] = []

      const tablesToBackfill: ClickhouseBackfillTable[] =
        referenceItem?.tablesToBackfill ?? []

      for await (const item of allItems) {
        batch.push(item)

        if (batch.length >= batchSize) {
          await insertToClickhouse(tableDefinition.table, batch, job.tenantId)
          // lastTimestamp is the timestamp of the last item in the batch
          const lastTimestamp: number = batch[batch.length - 1][
            timestampColumn
          ] as number
          const isTableInReferenceItem = tablesToBackfill.find(
            (t) => t.tableName === table
          )

          if (isTableInReferenceItem) {
            isTableInReferenceItem.lastTimestamp = lastTimestamp
          } else {
            tablesToBackfill.push({
              tableName: table,
              lastTimestamp,
            })

            await collection.updateOne(
              { tenantId, referenceId },
              { $set: { tablesToBackfill } }
            )
          }

          batch = []
        }
      }

      if (batch.length > 0) {
        await insertToClickhouse(tableDefinition.table, batch, job.tenantId)

        const lastTimestamp: number = batch[batch.length - 1][
          timestampColumn
        ] as number
        const isTableInReferenceItem = tablesToBackfill.find(
          (t) => t.tableName === table
        )

        if (isTableInReferenceItem) {
          isTableInReferenceItem.lastTimestamp = lastTimestamp
        } else {
          tablesToBackfill.push({
            tableName: table,
            lastTimestamp,
            isCompleted: true,
          })

          await collection.updateOne(
            { tenantId, referenceId },
            { $set: { tablesToBackfill } }
          )
        }
      }
    }
  }
}
