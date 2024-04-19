import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { fromIni } from '@aws-sdk/credential-providers'
import { SecretName, Secrets } from '@flagright/lib/secrets/secrets'
import { envIs } from './env'
import { WrappedError } from '@/utils/errors'

function getSecretManager() {
  return new SecretsManagerClient(
    envIs('local')
      ? {
          credentials: fromIni({
            profile: 'AWSAdministratorAccess-911899431626',
          }),
        }
      : { maxAttempts: 10 }
  )
}

export async function getSecretByName<T extends SecretName>(
  secretId: T,
  useCache = true
): Promise<Secrets[T]> {
  return getSecret(secretId, useCache)
}

const secretCache = new Map<string, any>()

export async function getSecret<T>(
  secretId: string,
  useCache = true
): Promise<T> {
  if (useCache && secretCache.has(secretId)) {
    return secretCache.get(secretId) as T
  }

  let secretString: string | undefined
  try {
    secretString = (
      await getSecretManager().send(
        new GetSecretValueCommand({
          SecretId: secretId,
        })
      )
    ).SecretString
  } catch (e) {
    if (envIs('local')) {
      console.error(
        `❗❗Please run 'npm run aws-login dev' to refresh the aws credentials for the Dev account!`
      )
    }
    throw new WrappedError(`No secret found for secret ${secretId}`, e)
  }
  if (!secretString) {
    throw new Error(`No secret found for secret ${secretId}`)
  }

  let secretValue: T
  try {
    secretValue = JSON.parse(secretString as string) as T
  } catch (e) {
    secretValue = secretString as any as T
  }

  secretCache.set(secretId, secretValue)
  return secretValue
}

export async function deleteSecret(secretId: string): Promise<void> {
  await getSecretManager().send(
    new DeleteSecretCommand({
      SecretId: secretId,
    })
  )
}

export async function createSecret(secretName: string, secretValues: object) {
  await getSecretManager().send(
    new CreateSecretCommand({
      Name: secretName,
      SecretString: JSON.stringify(secretValues),
    })
  )
}
