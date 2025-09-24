import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { fromIni } from '@aws-sdk/credential-providers'
import { SecretName, Secrets } from '@flagright/lib/secrets/secrets'
import memoize from 'lodash/memoize'
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

export const getSecret = memoize(async <T>(secretId: string): Promise<T> => {
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

  try {
    return JSON.parse(secretString as string) as T
  } catch (e) {
    return secretString as any as T
  }
})

export async function getSecretByName<T extends SecretName>(
  secretId: T,
  useCache = true
): Promise<Secrets[T]> {
  if (!useCache) {
    getSecret.cache.clear?.()
  }
  return getSecret(secretId)
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
