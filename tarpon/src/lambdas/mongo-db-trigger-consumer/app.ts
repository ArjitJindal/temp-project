import { EventBridgeEvent, SQSEvent } from 'aws-lambda'
import {
  ChangeStreamDeleteDocument,
  ChangeStreamInsertDocument,
  ChangeStreamReplaceDocument,
  ChangeStreamUpdateDocument,
  MongoClient,
} from 'mongodb'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { memoize } from 'lodash'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import {
  CLICKHOUSE_DEFINITIONS,
  ClickhouseTableDefinition,
  ClickHouseTables,
} from '@/utils/clickhouse-definition'
import { MONGO_TABLE_SUFFIX_MAP } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  batchInsertToClickhouse,
  getClickhouseClient,
  sanitizeTableName,
} from '@/utils/clickhouse-utils'
import { generateChecksum } from '@/utils/object'

type ChangeStreamDocument =
  | ChangeStreamInsertDocument
  | ChangeStreamUpdateDocument
  | ChangeStreamReplaceDocument
  | ChangeStreamDeleteDocument

const sqs = new SQSClient({
  region: process.env.AWS_REGION,
})

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

    const tableName = event.detail.ns.coll

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(event),
        MessageGroupId: generateChecksum(tableName),
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

export function handleMessages(records: ChangeStreamDocument[]): {
  messagesToDelete: Record<string, ChangeStreamDeleteDocument>
  messagesToReplace: Record<string, ChangeStreamReplaceDocument>
} {
  const messagesToDelete: Record<string, ChangeStreamDeleteDocument> = {}
  const messagesToReplace: Record<string, ChangeStreamReplaceDocument> = {}
  records.forEach((record) => {
    const {
      documentKey: { _id },
      clusterTime = 0,
      operationType,
    } = record
    const key = _id.toString()
    if (operationType === 'delete') {
      const deleteRecord = record as ChangeStreamDeleteDocument
      if (
        !messagesToReplace[key] ||
        (messagesToReplace[key]?.clusterTime ?? 0) < clusterTime
      ) {
        // Remove from messagesToReplace if exists and older
        delete messagesToReplace[key]
        // Add to messagesToDelete
        messagesToDelete[key] = deleteRecord
      }
    } else if (
      operationType === 'replace' ||
      operationType === 'insert' ||
      operationType === 'update'
    ) {
      const replaceRecord = record as ChangeStreamReplaceDocument
      if (
        !messagesToDelete[key] ||
        (messagesToDelete[key]?.clusterTime ?? 0) < clusterTime
      ) {
        // Remove from messagesToDelete if exists and older
        delete messagesToDelete[key]
        // Add to messagesToReplace
        messagesToReplace[key] = replaceRecord
      }
    }
  })

  return { messagesToDelete, messagesToReplace }
}

async function handleMessagesDelete(
  messagesToDelete: Record<string, ChangeStreamDeleteDocument>
) {
  return Object.values(messagesToDelete).map(async (doc) => {
    const tableDetails = fetchTableDetails(doc.ns.coll)
    if (!tableDetails) {
      return
    }
    // TODO: Handle Customized Delete Logic if Required
    const clickhouseClient = await getClickhouseClient()
    const { tenantId, clickhouseTable } = tableDetails
    const tableName = sanitizeTableName(`${tenantId}-${clickhouseTable.table}`)
    const query = `ALTER TABLE ${tableName} UPDATE is_deleted = 1 WHERE id = ${doc.documentKey._id}`
    await clickhouseClient.query({
      query,
    })
  })
}

async function handleMessagesReplace(
  mongoClient: MongoClient,
  messagesToReplace: Record<string, ChangeStreamReplaceDocument>
) {
  return Promise.all(
    Object.keys(messagesToReplace).map(async (tableName) => {
      const tableDetails = fetchTableDetails(tableName)
      if (!tableDetails) {
        return
      }

      const { tenantId, collectionName, clickhouseTable } = tableDetails

      const mongoCollection = mongoClient.db().collection(collectionName)
      const _ids = Object.values(messagesToReplace).map(
        (doc) => doc.documentKey._id
      )
      const documents = mongoCollection.find({
        _id: { $in: _ids },
      })

      const documentsToReplace = await documents.toArray()

      await batchInsertToClickhouse(
        clickhouseTable.table,
        documentsToReplace,
        tenantId
      )
    })
  )
}

export const mongoDbTriggerQueueConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    logger.info(`Processing ${event.Records.length} messages`)

    const { messagesToReplace, messagesToDelete } = handleMessages(
      event.Records.map((record) => JSON.parse(record.body))
    )

    const mongoClient = await getMongoDbClient()

    await Promise.all([
      handleMessagesReplace(mongoClient, messagesToReplace),
      handleMessagesDelete(messagesToDelete),
    ])
  }
)
