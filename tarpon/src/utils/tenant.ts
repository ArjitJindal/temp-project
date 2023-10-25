export const getFullTenantId = (tenantId: string, demoMode: boolean) => {
  if (tenantId.endsWith('-test')) {
    return tenantId
  }
  return tenantId + (demoMode ? `-test` : '')
}
