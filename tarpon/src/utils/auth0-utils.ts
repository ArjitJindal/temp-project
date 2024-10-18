import { AuthenticationClient, ManagementClient } from 'auth0'
import { memoize } from 'lodash'
import { getSecret } from './secrets-manager'
import { EscalationLevel } from '@/@types/openapi-internal/EscalationLevel'

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

export function isWhitelabelAuth0Domain(auth0Domain: string): boolean {
  return ![
    'dev-flagright.eu.auth0.com',
    'sandbox-flagright.eu.auth0.com',
    'flagright.eu.auth0.com',
  ].includes(auth0Domain)
}

export interface AppMetadata {
  role: string
  isReviewer?: boolean
  isReviewRequired?: boolean
  reviewerId?: string
  escalationLevel?: EscalationLevel
}

export const getAuth0ManagementClient = memoize(async (auth0Domain: string) => {
  const { clientId, clientSecret } = await getAuth0Credentials(auth0Domain)
  return new ManagementClient({
    domain: auth0Domain,
    clientId,
    clientSecret,
    retry: {
      enabled: true,
      maxRetries: 10,
      retryWhen: [500, 502, 503, 504, 408, 429, 524],
    },
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

export async function auth0AsyncWrapper<T>(
  asyncFunction: () => Promise<{ data: T }>
): Promise<T> {
  const result = await asyncFunction()
  return result.data
}
