import { getSecret } from './secrets-manager'

export type Auth0ManagementAPICreds = {
  clientId: string
  clientSecret: string
}

const cacheAuth0ManagementAPICreds: {
  [auth0Domain: string]: Auth0ManagementAPICreds
} = {}

export async function getAuth0Credentials(
  auth0Domain: string
): Promise<Auth0ManagementAPICreds> {
  if (cacheAuth0ManagementAPICreds[auth0Domain]) {
    return cacheAuth0ManagementAPICreds[auth0Domain]
  }
  const secrets = await getSecret<Auth0ManagementAPICreds>(auth0Domain)
  cacheAuth0ManagementAPICreds[auth0Domain] = secrets
  return cacheAuth0ManagementAPICreds[auth0Domain]
}

export function getAuth0Domain(tenantName: string, region: string) {
  return `${tenantName}.${region}.auth0.com`
}
