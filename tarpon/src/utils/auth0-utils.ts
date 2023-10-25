import { AuthenticationClient, ManagementClient } from 'auth0'
import { memoize } from 'lodash'
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

export interface AppMetadata {
  role: string
  isEscalationContact?: boolean
  isReviewer?: boolean
  isReviewRequired?: boolean
  reviewerId?: string
}

export const getAuth0ManagementClient = memoize(async (auth0Domain: string) => {
  const { clientId, clientSecret } = await getAuth0Credentials(auth0Domain)
  return new ManagementClient<AppMetadata>({
    domain: auth0Domain,
    clientId,
    clientSecret,
    retry: { enabled: true, maxRetries: 10 },
  })
})

export const getAuth0AuthenticationClient = memoize(
  async (auth0Domain: string) => {
    const { clientId, clientSecret } = await getAuth0Credentials(auth0Domain)
    return new AuthenticationClient({
      domain: auth0Domain,
      clientId,
      clientSecret,
    })
  }
)
