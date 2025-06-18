import { SQSEvent } from 'aws-lambda'
import { groupBy } from 'lodash'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ApiRequestLog } from '@/@types/request-logger'

export const handleRequestLoggerTask = async (logs: ApiRequestLog[]) => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const logGroups = groupBy(logs, (log) => log.tenantId)
  for (const tenantId in logGroups) {
    const tenantLogs = logGroups[tenantId]
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
