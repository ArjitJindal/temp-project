import { v4 as uuidv4 } from 'uuid'
import { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs/dist-types/models/models_0'
import { uniqBy } from 'lodash'
import {
  SecretsManagerWebhookSecrets,
  WebhookDeliveryTask,
} from '@/@types/webhook'
import { createSecret, deleteSecret, getSecret } from '@/utils/secrets-manager'
import { WebhookRepository } from '@/services/webhook/repositories/webhook-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { bulkSendMessages, getSQSClient } from '@/utils/sns-sqs-client'
import { envIs } from '@/utils/env'
import dayjs from '@/utils/dayjs'
import { handleWebhookDeliveryTask } from '@/lambdas/webhook-deliverer/utils'

const LOCAL_SECRET_KEY = 'test-secret'

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
  if (envIs('local')) {
    return
  }

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
  if (envIs('local')) {
    return {
      [LOCAL_SECRET_KEY]: dayjs().add(1, 'day').valueOf(),
    }
  }

  return (await getSecret<SecretsManagerWebhookSecrets>(
    getWebhookSecretKey(tenantId, webhookId)
  )) as SecretsManagerWebhookSecrets
}

const sqs = getSQSClient()

export type ThinWebhookDeliveryTask<T extends object = object> = Pick<
  WebhookDeliveryTask<T>,
  'event' | 'payload' | 'triggeredBy' | 'entityId'
>

export async function retryWebhookTasks<T extends object = object>(
  tenantId: string,
  webhookTasks: WebhookDeliveryTask<T>[]
) {
  await sendWebhookTasksToWebhooks(tenantId, {
    type: 'RETRY',
    tasks: webhookTasks,
  })
}

type WebhookTasks<T extends object = object> =
  | { type: 'RETRY'; tasks: WebhookDeliveryTask<T>[] }
  | { type: 'CREATE'; tasks: ThinWebhookDeliveryTask<T>[] }

async function sendWebhookTasksToWebhooks<T extends object = object>(
  tenantId: string,
  webhookTasks: WebhookTasks<T>
) {
  const createdAt = Date.now()
  const entries: SendMessageBatchRequestEntry[] = []
  const webhookRepository = new WebhookRepository(
    tenantId,
    await getMongoDbClient()
  )

  const webhooksByEvent = await webhookRepository.getWebhooksByEvents(
    (webhookTasks.tasks as Pick<WebhookDeliveryTask, 'event'>[]).map(
      (task) => task.event
    )
  )

  for (const webhookTask of webhookTasks.tasks) {
    for (const webhook of webhooksByEvent.get(webhookTask.event) || []) {
      if (webhookTasks.type === 'RETRY') {
        for (const task of webhookTasks.tasks) {
          entries.push({
            Id: task._id,
            MessageBody: JSON.stringify(task),
          })
        }
      } else {
        const task: WebhookDeliveryTask<T> = {
          ...webhookTask,
          _id: uuidv4(),
          tenantId,
          createdAt,
          webhookId: webhook._id as string,
        }

        entries.push({
          Id: task._id,
          MessageBody: JSON.stringify(task),
        })
      }
    }

    if (envIs('local') || envIs('test')) {
      logger.info(`Sending ${entries.length} webhooks to local queue`)
      await Promise.all(
        entries.map((entry) =>
          handleWebhookDeliveryTask(
            JSON.parse(entry.MessageBody as string) as WebhookDeliveryTask
          )
        )
      )

      return
    }
    const deduplicatedEntries = uniqBy(entries, 'Id')
    await bulkSendMessages(
      sqs,
      process.env.WEBHOOK_DELIVERY_QUEUE_URL as string,
      deduplicatedEntries
    )

    if (entries.length > 0) {
      logger.info(`${entries.length} webhooks sent`)
    }
  }
}

export async function sendWebhookTasks<T extends object = object>(
  tenantId: string,
  webhookTasks: ThinWebhookDeliveryTask<T>[]
) {
  await sendWebhookTasksToWebhooks(tenantId, {
    type: 'CREATE',
    tasks: webhookTasks,
  })
}

export function getNotExpiredSecrets(
  keys: SecretsManagerWebhookSecrets
): string[] {
  return Object.keys(keys).filter(
    (secret) => (keys?.[secret] || Number.MAX_SAFE_INTEGER) > Date.now()
  )
}
