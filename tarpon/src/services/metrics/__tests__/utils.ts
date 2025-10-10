import { ApiUsageMetricsService } from '../api-usage-metrics-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { prepareClickhouseInsert } from '@/utils/clickhouse/insert'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
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
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.REPORTS.tableName,
    tenantId
  )
  return new ApiUsageMetricsService({
    mongoDb: await getMongoDbClient(),
    dynamoDb: getDynamoDbClient(),
  })
}
