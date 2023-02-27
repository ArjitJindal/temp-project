import { v4 as uuidv4 } from 'uuid'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import {
  SecretsManagerWebhookSecrets,
  WebhookDeliveryTask,
} from '@/@types/webhook'
import { createSecret, deleteSecret, getSecret } from '@/utils/secrets-manager'
import { WebhookRepository } from '@/services/webhook/repositories/webhook-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { logger } from '@/core/logger'

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

const sqs = new SQSClient({})
export type ThinWebhookDeliveryTask = Pick<
  WebhookDeliveryTask,
  'event' | 'payload'
>

export async function sendWebhookTasks(
  tenantId: string,
  webhookTasks: ThinWebhookDeliveryTask[]
) {
  const createdAt = Date.now()
  const webhookRepository = new WebhookRepository(
    tenantId,
    await getMongoDbClient()
  )
  const webhooksByEvent = await webhookRepository.getWebhooksByEvents(
    webhookTasks.map((task) => task.event)
  )

  for (const webhookTask of webhookTasks) {
    for (const webhook of webhooksByEvent.get(webhookTask.event) || []) {
      const finalWebhookTask: WebhookDeliveryTask = {
        ...webhookTask,
        _id: uuidv4(),
        tenantId,
        webhookId: webhook._id as string,
        createdAt,
      }
      await sqs.send(
        new SendMessageCommand({
          MessageBody: JSON.stringify(finalWebhookTask),
          QueueUrl: process.env.WEBHOOK_DELIVERY_QUEUE_URL as string,
        })
      )
      logger.info(
        `Sent webhook delivery task for event ${finalWebhookTask.event}`
      )
    }
  }
}
