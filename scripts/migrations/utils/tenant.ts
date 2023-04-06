import { getConfig } from './config'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { TenantInfo, TenantService } from '@/services/tenants'

const config = getConfig()

export async function migrateAllTenants(
  migrationCallback: (tenant: Tenant, auth0Domain: string) => Promise<void>
) {
  try {
    const tenantInfos =
      config.stage === 'local'
        ? [
            {
              tenant: {
                id: 'flagright',
                name: 'Flagright',
              },
              auth0Domain: 'dev-flagright.eu.auth0.com',
            } as TenantInfo,
          ]
        : await TenantService.getAllTenants(config.stage, config.region)

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
