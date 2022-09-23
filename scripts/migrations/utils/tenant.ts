import { getConfig } from './config'
import {
  AccountsService,
  Tenant,
} from '@/lambdas/console-api-account/services/accounts-service'
import { AccountsConfig } from '@/lambdas/console-api-account/app'

const config = getConfig()

export async function migrateAllTenants(
  migrationCallback: (tenant: Tenant) => Promise<void>
) {
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )
  const tenants = await accountsService.getTenants()

  for (const tenant of tenants) {
    if (tenant.apiAudience === config.application.AUTH0_AUDIENCE) {
      console.info(`Migrating tenant ${tenant.name} (ID: ${tenant.id})`)
      await migrationCallback(tenant)
      console.info(`Migrated tenant ${tenant.name} (ID: ${tenant.id})`)
    }
  }

  console.info('Migration completed.')
}
