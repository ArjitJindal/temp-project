import { SQSEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RequestLogger } from '@/@types/request-logger'

export const handleRequestLoggerTask = async (task: RequestLogger) => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const tenantId = task.tenantId
  const requestLoggerCollectionName = API_REQUEST_LOGS_COLLECTION(tenantId)
  await db.collection(requestLoggerCollectionName).insertOne(task)
}

export const requestLoggerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    await Promise.all(
      event.Records.map(async (record) => {
        await handleRequestLoggerTask(JSON.parse(record.body) as RequestLogger)
      })
    )
  }
)
