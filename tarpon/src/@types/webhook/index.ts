import { WebhookEventType } from '../openapi-public/WebhookEventType'

export type SecretsManagerWebhookSecrets = {
  [key: string]: number | null
}

export type WebhookDeliveryTask = {
  _id: string
  webhookId: string
  tenantId: string
  event: WebhookEventType
  createdAt: number
  payload: any
}
