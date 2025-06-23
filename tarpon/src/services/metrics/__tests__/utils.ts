import { ApiUsageMetricsService } from '../api-usage-metrics-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { prepareClickhouseInsert } from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const getApiUsageMetricsService = async (tenantId: string) => {
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
    tenantId
  )
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName,
    tenantId
  )
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.USERS.tableName,
    tenantId
  )
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.USER_EVENTS.tableName,
    tenantId
  )
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.METRICS.tableName,
    tenantId
  )
  return new ApiUsageMetricsService({
    mongoDb: await getMongoDbClient(),
    dynamoDb: getDynamoDbClient(),
  })
}
