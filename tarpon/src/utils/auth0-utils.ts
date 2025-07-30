import {
  AuthenticationClient,
  GetOrganizations200ResponseOneOfInner,
  GetUsers200ResponseOneOfInner,
  ManagementClient,
  PostOrganizationsRequest,
} from 'auth0'
import { Conflict } from 'http-errors'
import { memoize, uniq } from 'lodash'
import { getSecret } from './secrets-manager'
import dayjs from './dayjs'
import { EscalationLevel } from '@/@types/openapi-internal/EscalationLevel'
import { Tenant } from '@/services/accounts/repository'
import { Account } from '@/@types/openapi-internal/Account'
import { Permission } from '@/@types/openapi-internal/Permission'
import { getContext } from '@/core/utils/context-storage'

export type Auth0ManagementAPICreds = {
  clientId: string
  clientSecret: string
}

export function hasPermission(permission: Permission): boolean {
  const userPermissions = getContext()?.authz?.permissions
  const hasPermission = userPermissions?.get(permission)
  return hasPermission ?? false
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

export const generateRandomPassword = () => {
  const randomString = 'TheBestProduct'
  const date = `${Date.now()}`
  const uniqDate = uniq(date).join('')
  const password = `P-${randomString}@${uniqDate}`
  return password
}

export const CONNECTION_NAME = 'Username-Password-Authentication'

export const organizationToTenant = (
  organization: GetOrganizations200ResponseOneOfInner
): Tenant => {
  const tenantId = organization.metadata.tenantId
  if (tenantId == null) {
    throw new Conflict('Invalid organization metadata, tenantId expected')
  }
  return {
    id: tenantId,
    name: organization.display_name || tenantId,
    orgId: organization.id,
    apiAudience: organization.metadata?.apiAudience,
    region: organization.metadata?.region,
    isProductionAccessDisabled:
      organization.metadata?.isProductionAccessDisabled === 'true',
    tenantCreatedAt: organization.metadata?.tenantCreatedAt,
    consoleApiUrl: organization.metadata?.consoleApiUrl,
    auth0Domain: organization.metadata?.auth0Domain,
    orgName: organization.name,
  }
}

export const tenantToOrganization = (
  tenant: Tenant
): PostOrganizationsRequest => {
  return {
    name: tenant.name,
    metadata: {
      tenantId: tenant.id,
      consoleApiUrl: tenant.consoleApiUrl,
      apiAudience: tenant.apiAudience,
      auth0Domain: tenant.auth0Domain,
      region: tenant.region,
      isProductionAccessDisabled: tenant.isProductionAccessDisabled
        ? 'true'
        : 'false',
      tenantCreatedAt: tenant.tenantCreatedAt,
    },
  }
}

export function userToAccount(user: GetUsers200ResponseOneOfInner): Account {
  const {
    app_metadata,
    user_id,
    email,
    last_login,
    created_at,
    last_password_reset,
  } = user

  if (user_id == null) {
    throw new Conflict('User id can not be null')
  }
  if (email == null) {
    throw new Conflict('User email can not be null')
  }
  const role: string = app_metadata ? app_metadata.role : 'user'

  return {
    id: user_id,
    role: role,
    email: email,
    emailVerified: user.email_verified ?? false,
    name: user.name ?? '',
    picture: user.picture,
    blocked: user.blocked ?? false,
    reviewerId: app_metadata?.reviewerId,
    ...(app_metadata?.blockedReason && {
      blockedReason: app_metadata.blockedReason,
    }),
    lastLogin: dayjs(last_login as string).valueOf(),
    createdAt: dayjs(created_at as string).valueOf(),
    lastPasswordReset: dayjs(last_password_reset as string).valueOf(),
    escalationLevel: app_metadata?.escalationLevel,
    escalationReviewerId: app_metadata?.escalationReviewerId,
    isReviewer: app_metadata?.isReviewer,
    demoMode: user.user_metadata?.demoMode ?? false,
    staffId: user.user_metadata?.staffId,
    department: user.user_metadata?.department,
  }
}
