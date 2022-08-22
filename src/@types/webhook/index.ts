import { WebhookEvent } from '../openapi-internal/WebhookEvent'

export type SecretsManagerWebhookSecrets = {
  [key: string]: number | null
}

export type WebhookDeliveryTask = {
  _id: string
  webhookId: string
  tenantId: string
  event: WebhookEvent
  createdAt: number
  payload: object
}
