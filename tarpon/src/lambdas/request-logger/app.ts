import { SQSEvent } from 'aws-lambda'
import { groupBy } from 'lodash'
import { StackConstants } from '@lib/constants'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ApiRequestLog } from '@/@types/request-logger'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/utils'
import {
  getDynamoDbClient,
  sanitizeMongoObject,
  transactWrite,
  TransactWriteOperation,
} from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKeys: { PartitionKeyID: string; SortKeyID?: string }[]
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  for (const primaryKey of primaryKeys) {
    await localTarponChangeCaptureHandler(tenantId, primaryKey, 'TARPON')
  }
}

export const handleRequestLoggerTask = async (logs: ApiRequestLog[]) => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const logGroups = groupBy(logs, (log) => log.tenantId)
  for (const tenantId in logGroups) {
    const tenantLogs = logGroups[tenantId]
    if (isClickhouseEnabledInRegion()) {
      await saveApiRequestLogsToDynamo(tenantLogs, tenantId)
    }
    const requestLoggerCollectionName = API_REQUEST_LOGS_COLLECTION(tenantId)
    await db
      .collection(requestLoggerCollectionName)
      .insertMany(tenantLogs, { ordered: false })
  }
}

export const requestLoggerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const logs = event.Records.map(
      (record) => JSON.parse(record.body) as ApiRequestLog
    )
    await handleRequestLoggerTask(logs)
  }
)

export const saveApiRequestLogsToDynamo = async (
  logs: ApiRequestLog[],
  tenantId: string
) => {
  const keys: { PartitionKeyID: string; SortKeyID?: string }[] = []
  const dynamoDb = getDynamoDbClient()
  const writeRequests: TransactWriteOperation[] = []
  for (const log of logs) {
    if (!log.requestId) {
      continue
    }
    const key = DynamoDbKeys.API_REQUEST_LOGS(tenantId, log.requestId)
    keys.push(key)
    writeRequests.push({
      Put: {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
        Item: {
          ...key,
          ...sanitizeMongoObject(log),
        },
      },
    })
  }
  await transactWrite(dynamoDb, writeRequests)
  if (process.env.NODE_ENV === 'development') {
    await handleLocalChangeCapture(tenantId, keys)
  }
}
