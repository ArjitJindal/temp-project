import { EventBridgeEvent, SQSEvent } from 'aws-lambda'
import {
  ChangeStreamDeleteDocument,
  ChangeStreamInsertDocument,
  ChangeStreamReplaceDocument,
  ChangeStreamUpdateDocument,
  MongoClient,
  ObjectId,
} from 'mongodb'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { Dictionary, groupBy, memoize } from 'lodash'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickhouseTableDefinition,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import { MONGO_TABLE_SUFFIX_MAP } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  batchInsertToClickhouse,
  getClickhouseClient,
  sanitizeTableName,
} from '@/utils/clickhouse/utils'

type ChangeStreamDocument =
  | ChangeStreamInsertDocument
  | ChangeStreamUpdateDocument
  | ChangeStreamReplaceDocument
  | ChangeStreamDeleteDocument

const sqs = new SQSClient({
  region: process.env.AWS_REGION,
})

export type MongoConsumerSQSMessage = {
  collectionName: string
  operationType: 'insert' | 'update' | 'replace' | 'delete'
  documentKey: {
    _id: string
  }
  clusterTime: number
}

const MONGO_SUFFIX_TO_CLICKHOUSE_TABLE_MAP = {
  [MONGO_TABLE_SUFFIX_MAP.TRANSACTIONS]:
    CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
  [MONGO_TABLE_SUFFIX_MAP.USERS]: CLICKHOUSE_DEFINITIONS.USERS.tableName,
  [MONGO_TABLE_SUFFIX_MAP.TRANSACTION_EVENTS]:
    CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName,
  [MONGO_TABLE_SUFFIX_MAP.USER_EVENTS]:
    CLICKHOUSE_DEFINITIONS.USER_EVENTS.tableName,
  [MONGO_TABLE_SUFFIX_MAP.CASES]: CLICKHOUSE_DEFINITIONS.CASES.tableName,
}

export const mongoDbTriggerConsumerHandler = lambdaConsumer()(
  async (event: EventBridgeEvent<string, ChangeStreamDocument>) => {
    const queueUrl = process.env.MONGO_DB_CONSUMER_QUEUE_URL

    if (!queueUrl) {
      throw new Error('MONGO_DB_CONSUMER_QUEUE_URL is not set')
    }

    const eventData: MongoConsumerSQSMessage = {
      collectionName: event.source,
      operationType: event.detail.operationType,
      documentKey: {
        _id: event.detail.documentKey._id.toString(),
      },
      clusterTime: event.detail?.clusterTime
        ? event.detail.clusterTime.toNumber()
        : Date.now(),
    }

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(eventData),
      })
    )
  }
)

const findClickhouseTableDefinition = memoize(
  (clickhouseTableName: string): ClickhouseTableDefinition => {
    return ClickHouseTables.find(
      (table) => table.table === clickhouseTableName
    ) as ClickhouseTableDefinition
  }
)

type TableDetails = {
  tenantId: string
  collectionName: string
  clickhouseTable: ClickhouseTableDefinition
}

export const fetchTableDetails = (tableName: string): TableDetails | false => {
  const tableSuffix = Object.keys(MONGO_SUFFIX_TO_CLICKHOUSE_TABLE_MAP).find(
    (key) => tableName.endsWith(key)
  )

  if (!tableSuffix) {
    return false
  }

  const tenantId = tableName.replace(`-${tableSuffix}`, '')
  return {
    tenantId,
    collectionName: tableName,
    clickhouseTable: findClickhouseTableDefinition(
      MONGO_SUFFIX_TO_CLICKHOUSE_TABLE_MAP[tableSuffix]
    ),
  }
}

type SQSMessagesType = MongoConsumerSQSMessage

export function segregateMessages(records: SQSMessagesType[]): {
  messagesToDelete: Dictionary<SQSMessagesType[]>
  messagesToReplace: Dictionary<SQSMessagesType[]>
} {
  const messagesToDelete: Record<string, MongoConsumerSQSMessage> = {}
  const messagesToReplace: Record<string, MongoConsumerSQSMessage> = {}

  for (const record of records) {
    const { operationType, documentKey, clusterTime } = record
    const { _id } = documentKey

    if (operationType === 'delete') {
      const deleteRecord = record

      if (
        !messagesToReplace[_id] ||
        (messagesToReplace[_id]?.clusterTime ?? 0) < clusterTime
      ) {
        delete messagesToReplace[_id]
        messagesToDelete[_id] = deleteRecord
      }
    } else if (['insert', 'update', 'replace'].includes(operationType)) {
      const replaceRecord = record

      if (
        !messagesToDelete[_id] ||
        (messagesToDelete[_id]?.clusterTime ?? 0) < clusterTime
      ) {
        delete messagesToDelete[_id]
        messagesToReplace[_id] = replaceRecord
      }
    }
  }

  // group records by collection name
  const messagesToDeleteArray = groupBy(
    Object.values(messagesToDelete),
    'collectionName'
  )
  const messagesToReplaceArray = groupBy(
    Object.values(messagesToReplace),
    'collectionName'
  )

  return {
    messagesToDelete: messagesToDeleteArray,
    messagesToReplace: messagesToReplaceArray,
  }
}

async function handleMessagesDelete(
  messagesToDelete: Dictionary<MongoConsumerSQSMessage[]>
) {
  return Promise.all(
    Object.entries(messagesToDelete).map(async ([collectionName, records]) => {
      const tableDetails = fetchTableDetails(collectionName)
      if (!tableDetails) {
        return
      }

      const { tenantId, clickhouseTable } = tableDetails
      const tableName = sanitizeTableName(
        `${tenantId}-${clickhouseTable.table}`
      )

      const clickhouseClient = await getClickhouseClient()

      const query = `ALTER TABLE ${tableName} UPDATE is_deleted = 1 WHERE mongo_id IN (${records
        .map((doc) => `'${doc.documentKey._id}'`)
        .join(', ')})`

      await clickhouseClient.query({
        query,
      })
    })
  )
}

async function handleMessagesReplace(
  mongoClient: MongoClient,
  messagesToReplace: Dictionary<MongoConsumerSQSMessage[]>
) {
  return Promise.all(
    Object.entries(messagesToReplace).map(async ([collectionName, records]) => {
      const tableDetails = fetchTableDetails(collectionName)
      if (!tableDetails) {
        return
      }

      const { tenantId, clickhouseTable } = tableDetails

      const mongoCollection = mongoClient.db().collection(collectionName)
      const _ids = records.map((doc) => new ObjectId(doc.documentKey._id))
      const documents = mongoCollection.find({ _id: { $in: _ids } })
      const documentsToReplace = await documents.toArray()

      await batchInsertToClickhouse(
        sanitizeTableName(`${tenantId}-${clickhouseTable.table}`),
        documentsToReplace,
        tenantId
      )
    })
  )
}

export const mongoDbTriggerQueueConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const events = event.Records.map((record) =>
      JSON.parse(record.body)
    ) as MongoConsumerSQSMessage[]

    await handleMongoConsumerSQSMessage(events)
  }
)

export const handleMongoConsumerSQSMessage = async (
  events: MongoConsumerSQSMessage[]
) => {
  const { messagesToReplace, messagesToDelete } = segregateMessages(events)

  const mongoClient = await getMongoDbClient()

  await Promise.all([
    handleMessagesReplace(mongoClient, messagesToReplace),
    handleMessagesDelete(messagesToDelete),
  ])
}
