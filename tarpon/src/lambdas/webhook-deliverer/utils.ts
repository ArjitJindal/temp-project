import { deliverWebhookEvent } from './app'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { updateLogMetadata } from '@/core/utils/context'
import { WebhookRepository } from '@/services/webhook/repositories/webhook-repository'
import { WebhookDeliveryRepository } from '@/services/webhook/repositories/webhook-delivery-repository'
import {
  getNotExpiredSecrets,
  getWebhookSecrets,
} from '@/services/webhook/utils'
import { WebhookDeliveryTask } from '@/@types/webhook'
import { WebhookRetryRepository } from '@/services/webhook/repositories/webhook-retry-repository'

export async function handleWebhookDeliveryTask(
  webhookDeliveryTask: WebhookDeliveryTask
) {
  updateLogMetadata({
    tenantId: webhookDeliveryTask.tenantId,
    event: webhookDeliveryTask.event,
    webhookId: webhookDeliveryTask.webhookId,
  })

  const mongoClient = await getMongoDbClient()
  const webhookRepository = new WebhookRepository(
    webhookDeliveryTask.tenantId,
    mongoClient
  )
  const webhook = await webhookRepository.getWebhook(
    webhookDeliveryTask.webhookId
  )
  if (
    !webhook?.enabled ||
    !webhook.events.includes(webhookDeliveryTask.event)
  ) {
    return
  }

  const webhookDeliveryRepository = new WebhookDeliveryRepository(
    webhookDeliveryTask.tenantId,
    mongoClient
  )
  const webhookRetryRepository = new WebhookRetryRepository(
    webhookDeliveryTask.tenantId,
    mongoClient
  )
  const latestAttempt =
    await webhookDeliveryRepository.getLatestWebhookDeliveryAttempt(
      webhookDeliveryTask._id
    )

  if (latestAttempt?.success) {
    await webhookRetryRepository.deleteWebhookRetryEvent(
      webhookDeliveryTask._id
    )

    return
  }
  const secretKeys = await getWebhookSecrets(
    webhookDeliveryTask.tenantId,
    webhookDeliveryTask.webhookId
  )
  await deliverWebhookEvent(
    webhook,
    getNotExpiredSecrets(secretKeys),
    webhookDeliveryTask
  )
}
