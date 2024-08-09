import { v4 as uuidv4 } from 'uuid'
import { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs/dist-types/models/models_0'
import {
  SecretsManagerWebhookSecrets,
  WebhookDeliveryTask,
} from '@/@types/webhook'
import { createSecret, deleteSecret, getSecret } from '@/utils/secrets-manager'
import { WebhookRepository } from '@/services/webhook/repositories/webhook-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { bulkSendMessages, getSQSClient } from '@/utils/sns-sqs-client'

export function getWebhookSecretKey(tenantId: string, webhookId: string) {
  return `${tenantId}/webhooks/${webhookId}`
}

export async function deleteWebhookSecrets(
  tenantId: string,
  webhookId: string
): Promise<void> {
  await deleteSecret(getWebhookSecretKey(tenantId, webhookId))
}

export async function createWebhookSecret(
  tenantId: string,
  webhookId: string,
  secret: string
): Promise<void> {
  const secretsManagerSecrets: SecretsManagerWebhookSecrets = {
    [secret]: null,
  }
  await createSecret(
    getWebhookSecretKey(tenantId, webhookId),
    secretsManagerSecrets
  )
}

export async function getWebhookSecrets(
  tenantId: string,
  webhookId: string
): Promise<SecretsManagerWebhookSecrets> {
  return (await getSecret<SecretsManagerWebhookSecrets>(
    getWebhookSecretKey(tenantId, webhookId)
  )) as SecretsManagerWebhookSecrets
}

const sqs = getSQSClient()

export type ThinWebhookDeliveryTask<T extends object = object> = Pick<
  WebhookDeliveryTask<T>,
  'event' | 'payload' | 'triggeredBy'
>

export async function sendWebhookTasks<T extends object = object>(
  tenantId: string,
  webhookTasks: ThinWebhookDeliveryTask<T>[]
) {
  const createdAt = Date.now()
  const webhookRepository = new WebhookRepository(
    tenantId,
    await getMongoDbClient()
  )
  const webhooksByEvent = await webhookRepository.getWebhooksByEvents(
    webhookTasks.map((task) => task.event)
  )

  const entries: SendMessageBatchRequestEntry[] = []
  for (const webhookTask of webhookTasks) {
    for (const webhook of webhooksByEvent.get(webhookTask.event) || []) {
      const finalWebhookTask: WebhookDeliveryTask<T> = {
        ...webhookTask,
        _id: uuidv4(),
        tenantId,
        webhookId: webhook._id as string,
        createdAt,
      }
      entries.push({
        Id: finalWebhookTask._id,
        MessageBody: JSON.stringify(finalWebhookTask),
      })
      logger.info(
        `Sending webhook delivery task for event type ${webhookTask.event}`
      )
    }
  }

  await bulkSendMessages(
    sqs,
    process.env.WEBHOOK_DELIVERY_QUEUE_URL as string,
    entries
  )

  if (entries.length > 0) {
    logger.info(`${entries.length} webhooks sent`)
  }
}
