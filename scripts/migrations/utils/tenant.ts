import { getConfig } from './config'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { TenantService } from '@/services/tenants'

const config = getConfig()

export async function migrateAllTenants(
  migrationCallback: (tenant: Tenant, auth0Domain: string) => Promise<void>
) {
  const tenantInfos = await TenantService.getAllTenants()
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

export async function removeFeatureFlags(featuresToRemove: string[]) {
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
    const newFeatures = tenantSettings.features.filter(
      (feature) => !featuresToRemove.includes(feature as string)
    )
    if (newFeatures.length === tenantSettings.features.length) {
      return
    }
    await tenantRepository.createOrUpdateTenantSettings({
      features: newFeatures || [],
    })
  })
}
