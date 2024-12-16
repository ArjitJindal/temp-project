import { memoize } from 'lodash'
import { getDynamoDbClient } from './dynamodb'
import { isWhitelabelAuth0Domain } from './auth0-utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'

export const getFullTenantId = (tenantId: string, demoMode: boolean) => {
  if (tenantId.endsWith('-test')) {
    return tenantId
  }
  return tenantId + (demoMode ? `-test` : '')
}

export const isDemoTenant = (tenantId: string) => {
  return tenantId.endsWith('-test')
}

export const getNonDemoTenantId = (tenantId: string) => {
  return tenantId.replace(/-test$/, '')
}

export const isTenantWhitelabeled = memoize(
  async (tenantId) => {
    const dynamoDb = getDynamoDbClient()
    const tenantRepository = new TenantRepository(tenantId, { dynamoDb })

    const tenantSettings = await tenantRepository.getTenantSettings([
      'auth0Domain',
    ])

    return isWhitelabeledTenantFromSettings(tenantSettings)
  },
  (tenantId) => tenantId
)

export const isWhitelabeledTenantFromSettings = (
  settings: Pick<TenantSettings, 'auth0Domain'>
): boolean => {
  return !!settings.auth0Domain && isWhitelabelAuth0Domain(settings.auth0Domain)
}
