import { WebhookDeliveryRepository } from '@/services/webhook/repositories/webhook-delivery-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { WebhookRepository } from '@/services/webhook/repositories/webhook-repository'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { prepareClickhouseInsert } from '@/utils/clickhouse/utils'
const webhookDeliveryClickhouseTableName =
  CLICKHOUSE_DEFINITIONS.WEBHOOK_DELIVERIES.tableName
const webhookClickhouseTableName = CLICKHOUSE_DEFINITIONS.WEBHOOK.tableName
export const getWebhookDeliveryRepository = async (tenantId: string) => {
  const mongoDb = await getMongoDbClient()
  await prepareClickhouseInsert(webhookClickhouseTableName, tenantId)
  await prepareClickhouseInsert(webhookDeliveryClickhouseTableName, tenantId)
  return new WebhookDeliveryRepository(tenantId, mongoDb)
}

export const getWebhookRepository = async (tenantId: string) => {
  const mongoDb = await getMongoDbClient()
  await prepareClickhouseInsert(webhookClickhouseTableName, tenantId)
  await prepareClickhouseInsert(webhookDeliveryClickhouseTableName, tenantId)
  return new WebhookRepository(tenantId, mongoDb)
}
