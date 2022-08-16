export function getWebhookSecretKey(tenantId: string, webhookId: string) {
  return `${tenantId}/webhooks/${webhookId}`
}
