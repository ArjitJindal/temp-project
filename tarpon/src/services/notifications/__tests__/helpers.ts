import { NotificationRepository } from '../notifications-repository'
import { prepareClickhouseInsert } from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

export const getNotificationRepository = async (tenantId: string) => {
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.NOTIFICATIONS.tableName,
    tenantId
  )
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.WEBHOOK.tableName,
    tenantId
  )
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.WEBHOOK_DELIVERIES.tableName,
    tenantId
  )
  return new NotificationRepository(tenantId, {
    mongoDb: await getMongoDbClient(),
    dynamoDb: getDynamoDbClient(),
  })
}
