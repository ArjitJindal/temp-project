import { FindCursor, WithId } from 'mongodb'
import { BatchJobRunner } from './batch-job-runner-base'
import { ClickhouseDataBackfillBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO,
  ClickhouseTableNames,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { batchInsertToClickhouse } from '@/utils/clickhouse/utils'
import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import { getDynamoDbClient } from '@/utils/dynamodb'

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
    const { tableNames, type } = parameters
    const fromTimestamp = type.type === 'PARTIAL' ? type.fromTimestamp : 0
    const toTimestamp =
      type.type === 'PARTIAL' ? type.toTimestamp : Number.MAX_SAFE_INTEGER
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
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

      let allItems: FindCursor<WithId<object>>

      if (parameters.type.type === 'ALL') {
        allItems = mongoCollection
          .find({})
          .sort({ [timestampColumn]: 1 })
          .addCursorFlag('noCursorTimeout', true)
      } else {
        allItems = mongoCollection
          .find({
            [timestampColumn]: {
              $gte: Math.max(fromTimestamp, tableItem?.lastTimestamp ?? 0),
              $lte: toTimestamp,
            },
          })
          .sort({ [timestampColumn]: 1 })
          .addCursorFlag('noCursorTimeout', true)
      }

      const batchSize = 1000
      let batch: WithId<object>[] = []

      const tablesToBackfill: ClickhouseBackfillTable[] =
        referenceItem?.tablesToBackfill ?? []

      const processBatch = async (
        batch: WithId<object>[],
        isLastBatch: boolean = false
      ) => {
        if (batch.length === 0) {
          return
        }

        const mongoDbConsumer = new MongoDbConsumer(mongoDb, dynamoDb)

        const updatedDocuments = await mongoDbConsumer.updateInsertMessages(
          mongoCollectionReference,
          batch as WithId<Document>[]
        )

        await batchInsertToClickhouse(
          job.tenantId,
          tableDefinition.table,
          updatedDocuments
        )

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
            ...(isLastBatch && { isCompleted: true }),
          })

          await collection.updateOne(
            { tenantId, referenceId },
            { $set: { tablesToBackfill } }
          )
        }
      }

      for await (const item of allItems) {
        batch.push(item)
        if (batch.length === batchSize) {
          await processBatch(batch)
          batch = []
        }
      }

      if (batch.length > 0) {
        await processBatch(batch, true)
      }
    }
  }
}
