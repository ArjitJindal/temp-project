export type WebhookEventType = 'USER_STATUS_UPDATED'

export type WebhookConfiguration = {
  _id?: string
  created: number
  webhookUrl: string
  events: WebhookEventType[]
  enabled: boolean
}

export type WebhookDeliveryTask = {
  _id: string
  webhookId: string
  tenantId: string
  event: WebhookEventType
  webhookUrl: string
  createdAt: number
  payload: object
}

export type WebhookDeliveryAttempt = {
  _id: string
  deliveryTaskId: string
  webhookId: string
  webhookUrl: string
  requestStartedAt: number
  requestFinishedAt: number
  success: boolean
  event: WebhookEventType
  eventCreatedAt: number
  request: {
    headers: any
    body: any
  }
  response?: {
    status: number
    headers: any
    body: any
  }
}
