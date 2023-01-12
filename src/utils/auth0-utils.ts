export type Auth0ManagementAPICreds = {
  clientId: string
  clientSecret: string
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk')
const secretsmanager = new AWS.SecretsManager()
const AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN = process.env
  .AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN as string

let cacheAuth0ManagementAPICreds: Auth0ManagementAPICreds

export async function getAuth0Credentials() {
  if (cacheAuth0ManagementAPICreds) {
    return cacheAuth0ManagementAPICreds
  }
  const smRes = await secretsmanager
    .getSecretValue({
      SecretId: AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN,
    })
    .promise()
  cacheAuth0ManagementAPICreds = JSON.parse(smRes.SecretString)
  return cacheAuth0ManagementAPICreds
}
