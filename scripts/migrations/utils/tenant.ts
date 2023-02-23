import { getAuth0TenantConfigs } from '@cdk/auth0/tenant-config'
import { getConfig } from './config'
import { AccountsService, Tenant } from '@/services/accounts'
import { getAuth0Domain } from '@/utils/auth0-utils'

const config = getConfig()

export async function migrateAllTenants(
  migrationCallback: (tenant: Tenant, auth0Domain: string) => Promise<void>
) {
  const tenantInfos: Array<{ tenant: Tenant; auth0Domain: string }> = []
  const auth0TenantConfigs = getAuth0TenantConfigs(config.stage)
  for (const auth0TenantConfig of auth0TenantConfigs) {
    const auth0Domain = getAuth0Domain(
      auth0TenantConfig.tenantName,
      auth0TenantConfig.region
    )
    const accountsService = new AccountsService({
      auth0Domain,
    })
    tenantInfos.push(
      ...(await accountsService.getTenants()).map((tenant) => ({
        tenant,
        auth0Domain,
      }))
    )
  }

  const targetTenantInfos = tenantInfos.filter(
    (tenantInfo) =>
      config.stage !== 'prod' || tenantInfo.tenant.region === config.region
  )
  if (targetTenantInfos.length === 0) {
    console.warn('No tenants found for running the migration!')
    return
  }

  for (const tenantInfo of targetTenantInfos) {
    console.info(
      `Migrating tenant ${tenantInfo.tenant.name} (ID: ${tenantInfo.tenant.id})`
    )
    await migrationCallback(tenantInfo.tenant, tenantInfo.auth0Domain)
    console.info(
      `Migrated tenant ${tenantInfo.tenant.name} (ID: ${tenantInfo.tenant.id})`
    )
  }

  console.info('Migration completed.')
}
