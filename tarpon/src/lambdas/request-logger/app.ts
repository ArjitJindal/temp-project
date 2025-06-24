import { SQSEvent } from 'aws-lambda'
import { groupBy } from 'lodash'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ApiRequestLog } from '@/@types/request-logger'
import {
  batchInsertToClickhouse,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

export const handleRequestLoggerTask = async (logs: ApiRequestLog[]) => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const filteredLogs = logs.filter(
    (log) => log.tenantId && log.tenantId !== 'undefined'
  )
  const logGroups = groupBy(filteredLogs, (log) => log.tenantId)
  for (const tenantId in logGroups) {
    const tenantLogs = logGroups[tenantId]
    if (isClickhouseEnabledInRegion()) {
      await handleRequestLoggerTaskClickhouse(tenantId, tenantLogs)
    }
    const requestLoggerCollectionName = API_REQUEST_LOGS_COLLECTION(tenantId)
    await db
      .collection(requestLoggerCollectionName)
      .insertMany(tenantLogs, { ordered: false })
  }
}
export const handleRequestLoggerTaskClickhouse = async (
  tenantId: string,
  logs: ApiRequestLog[]
) => {
  await batchInsertToClickhouse(
    tenantId,
    CLICKHOUSE_DEFINITIONS.API_REQUEST_LOGS.tableName,
    logs
  )
}
export const requestLoggerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const logs = event.Records.map(
      (record) => JSON.parse(record.body) as ApiRequestLog
    )
    await handleRequestLoggerTask(logs)
  }
)
