import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { WrappedError } from '@/utils/errors'

function getSecretManager() {
  return new SecretsManagerClient({})
}

export async function getSecret<T>(secretId: string): Promise<T> {
  let secretString: string | undefined
  console.log(`Getting secret ${secretId}`)
  try {
    secretString = (
      await getSecretManager().send(
        new GetSecretValueCommand({
          SecretId: secretId,
        })
      )
    ).SecretString
  } catch (e) {
    if (process.env.ENV === 'local') {
      console.error(
        `❗❗Please run 'npm run aws-sso-login:dev' to refresh the aws credentials for the Dev account!`
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
