import { SQSEvent } from 'aws-lambda'
import { BatchRerunUsersJobPayload } from '@/@types/rerun-users'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { initializeTenantContext, withContext } from '@/core/utils/context'
import { BatchRerunUsersService } from '@/services/batch-users-rerun'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const batchRerunUsersConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    for (const record of event.Records) {
      const job = JSON.parse(record.body) as BatchRerunUsersJobPayload
      const service = new BatchRerunUsersService(job.tenantId, {
        dynamoDb,
        mongoDb,
      })

      await withContext(async () => {
        await initializeTenantContext(job.tenantId)
        await service.run(job)
      })
    }
  }
)
