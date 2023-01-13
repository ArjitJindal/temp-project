import { SecretsManagerWebhookSecrets } from '@/@types/webhook'
import { createSecret, deleteSecret, getSecret } from '@/utils/secrets-manager'

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
