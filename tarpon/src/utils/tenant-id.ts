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
