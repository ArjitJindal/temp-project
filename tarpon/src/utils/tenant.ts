import { isWhitelabelAuth0Domain } from './auth0-utils'
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

export const isWhitelabeledTenantFromSettings = (
  settings: Pick<TenantSettings, 'auth0Domain'>
): boolean => {
  return !!settings.auth0Domain && isWhitelabelAuth0Domain(settings.auth0Domain)
}
