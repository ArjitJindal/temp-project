import { SQSEvent } from 'aws-lambda'
import { handleV8PreAggregationTask } from '../transaction-aggregation/app'
import { V8LogicAggregationRebuildTask } from '@/@types/tranasction/aggregation'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { initializeTenantContext, withContext } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const preAggregationConsumer = lambdaConsumer()(
  async (event: SQSEvent) => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    await Promise.all(
      event.Records.map(async (record) => {
        const task = JSON.parse(record.body) as V8LogicAggregationRebuildTask
        await withContext(
          async () => {
            await initializeTenantContext(task.tenantId)
            await handleV8PreAggregationTask(task, dynamoDb, mongoDb)
          },
          {
            ...(getContext() ?? {}),
            tenantId: task.tenantId,
          }
        )
      })
    )
  }
)
