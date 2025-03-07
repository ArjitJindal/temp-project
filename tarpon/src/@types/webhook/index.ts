import { WebhookEventType } from '../openapi-public/WebhookEventType'

export type SecretsManagerWebhookSecrets = {
  [key: string]: number | null
}

export type WebhookDeliveryTask<T extends object = object> = {
  _id: string
  webhookId: string
  tenantId: string
  event: WebhookEventType
  createdAt: number
  payload: T
  triggeredBy: 'MANUAL' | 'SYSTEM'
  entityId: string
}

export type WebhookRetryTask<T extends object = object> = {
  eventId: string
  task: WebhookDeliveryTask<T>
  lastRetryAt: number
  retryAfter: number
  lastRetryMinutes: number
}
