import { getConfig } from './config'
import { AccountsService, Tenant } from '@/services/accounts'
import { AccountsConfig } from '@/lambdas/console-api-account/app'

const config = getConfig()

export async function migrateAllTenants(
  migrationCallback: (tenant: Tenant) => Promise<void>
) {
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )
  const tenants = await accountsService.getTenants()
  const targetTenants = tenants.filter(
    (tenant) => config.stage !== 'prod' || tenant.region === config.region
  )
  if (targetTenants.length === 0) {
    throw new Error('No tenants found for running the migration!')
  }

  for (const tenant of targetTenants) {
    console.info(`Migrating tenant ${tenant.name} (ID: ${tenant.id})`)
    await migrationCallback(tenant)
    console.info(`Migrated tenant ${tenant.name} (ID: ${tenant.id})`)
  }

  console.info('Migration completed.')
}
