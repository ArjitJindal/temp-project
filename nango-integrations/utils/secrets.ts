import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'

const secretsManager = new SecretsManagerClient({})

export const getSecret = async <T>(secretName: string): Promise<T> => {
  const secret = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretName })
  )

  if (!secret.SecretString) {
    throw new Error(`Secret ${secretName} not found`)
  }

  try {
    return JSON.parse(secret.SecretString) as T
  } catch (e) {
    throw new Error(`Secret ${secretName} is not a valid JSON string`)
  }
}
