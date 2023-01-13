import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { fromIni } from '@aws-sdk/credential-providers'

const secretsmanager =
  process.env.ENV === 'local'
    ? new SecretsManagerClient({
        region: 'eu-central-1',
        credentials: fromIni({
          profile: 'AWSAdministratorAccess-911899431626',
        }),
      })
    : new SecretsManagerClient({})

export async function getSecret<T>(secretId: string): Promise<T> {
  let secretString: string | undefined
  try {
    secretString = (
      await secretsmanager.send(
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
    throw e
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
  await secretsmanager.send(
    new DeleteSecretCommand({
      SecretId: secretId,
    })
  )
}

export async function createSecret(secretName: string, secretValues: object) {
  await secretsmanager.send(
    new CreateSecretCommand({
      Name: secretName,
      SecretString: JSON.stringify(secretValues),
    })
  )
}
