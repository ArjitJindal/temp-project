import { getSecret } from './secrets-manager'

export type Auth0ManagementAPICreds = {
  clientId: string
  clientSecret: string
}

const AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN = process.env
  .AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN as string

let cacheAuth0ManagementAPICreds: Auth0ManagementAPICreds

export async function getAuth0Credentials() {
  if (cacheAuth0ManagementAPICreds) {
    return cacheAuth0ManagementAPICreds
  }
  cacheAuth0ManagementAPICreds = await getSecret<Auth0ManagementAPICreds>(
    AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN
  )
  return cacheAuth0ManagementAPICreds
}
