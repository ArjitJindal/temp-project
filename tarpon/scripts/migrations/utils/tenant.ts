import { getConfig } from './config'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { TenantService } from '@/services/tenants'
import { FEATURES } from '@/@types/openapi-internal-custom/Feature'
import { Feature } from '@/@types/openapi-internal/Feature'

const config = getConfig()

export async function migrateAllTenants(
  migrationCallback: (tenant: Tenant, auth0Domain: string) => Promise<void>
) {
  try {
    const tenantInfos = await TenantService.getAllTenants(
      config.stage,
      config.region
    )

    if (tenantInfos.length === 0) {
      throw new Error(
        'No tenants found for running the migration! Fix it ASAP!'
      )
    }

    for (const tenantInfo of tenantInfos) {
      console.info(
        `Migrating tenant ${tenantInfo.tenant.name} (ID: ${tenantInfo.tenant.id})`
      )
      await migrationCallback(tenantInfo.tenant, tenantInfo.auth0Domain)
      console.info(
        `Migrated tenant ${tenantInfo.tenant.name} (ID: ${tenantInfo.tenant.id})`
      )
    }

    console.info('Migration completed.')
  } catch (e) {
    console.error(e)
    throw e
  }
}

export async function syncFeatureFlags() {
  await migrateAllTenants(async (tenant: Tenant) => {
    const dynamoDb = await getDynamoDbClient()
    const tenantRepository = new TenantRepository(tenant.id, {
      dynamoDb,
    })
    const tenantSettings = await tenantRepository.getTenantSettings([
      'features',
    ])
    if (!tenantSettings.features) {
      return
    }
    await tenantRepository.createOrUpdateTenantSettings({
      features: tenantSettings.features.filter((feature) =>
        FEATURES.includes(feature as Feature)
      ),
    })
  })
}
