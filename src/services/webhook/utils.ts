import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { logger } from '@/core/logger'
import { SecretsManagerWebhookSecrets } from '@/@types/webhook'

const secretsmanager = new SecretsManagerClient({
  endpoint: process.env.ENV === 'local' ? 'https://0.0.0.0:4566' : undefined,
})

export function getWebhookSecretKey(tenantId: string, webhookId: string) {
  return `${tenantId}/webhooks/${webhookId}`
}

export async function deleteWebhookSecrets(
  tenantId: string,
  webhookId: string
): Promise<void> {
  await secretsmanager.send(
    new DeleteSecretCommand({
      SecretId: getWebhookSecretKey(tenantId, webhookId),
    })
  )
}

export async function createWebhookSecret(
  tenantId: string,
  webhookId: string,
  secret: string
): Promise<void> {
  const secretsManagerSecrets: SecretsManagerWebhookSecrets = {
    [secret]: null,
  }
  await secretsmanager.send(
    new CreateSecretCommand({
      Name: getWebhookSecretKey(tenantId, webhookId),
      SecretString: JSON.stringify(secretsManagerSecrets),
    })
  )
}

export async function getWebhookSecrets(
  tenantId: string,
  webhookId: string
): Promise<SecretsManagerWebhookSecrets> {
  const secretsResponse = await secretsmanager.send(
    new GetSecretValueCommand({
      SecretId: getWebhookSecretKey(tenantId, webhookId),
    })
  )
  if (!secretsResponse.SecretString) {
    logger.error(`Cannot fetch secrets for webhook ${webhookId}.`)
  }
  return secretsResponse.SecretString
    ? JSON.parse(secretsResponse.SecretString)
    : {}
}
