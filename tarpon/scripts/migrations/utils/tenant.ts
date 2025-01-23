import { Auth0DevTenantConfig } from '@lib/configs/auth0/tenant-config-dev'
import { cloneDeep } from 'lodash'
import { getConfig } from './config'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { TenantInfo, TenantService } from '@/services/tenants'
import { FEATURES } from '@/@types/openapi-internal-custom/Feature'
import { Feature } from '@/@types/openapi-internal/Feature'
import { envIs } from '@/utils/env'
import { getFullTenantId } from '@/utils/tenant'
import {
  initializeTenantContext,
  tenantSettings,
  withContext,
} from '@/core/utils/context'

const config = getConfig()

export async function migrateAllTenants(
  migrationCallback: (tenant: Tenant, auth0Domain: string) => Promise<void>
) {
  try {
    let tenantInfos: TenantInfo[] = []
    if (envIs('local')) {
      tenantInfos = [
        {
          tenant: {
            id: 'flagright',
            name: 'Flagright',
            orgId: '',
            apiAudience: '',
            region: 'local',
            isProductionAccessDisabled: false,
            tenantCreatedAt: new Date().toISOString(),
            consoleApiUrl: 'https://console.flagright.com',
            auth0Domain: 'dev-flagright.eu.auth0.com',
          },
          auth0TenantConfig: Auth0DevTenantConfig,
          auth0Domain: 'dev-flagright.eu.auth0.com',
        },
      ]
    } else {
      tenantInfos = await TenantService.getAllTenants(
        config.stage,
        config.region
      )
    }

    if (tenantInfos.length === 0) {
      throw new Error(
        'No tenants found for running the migration! Fix it ASAP!'
      )
    }
    tenantInfos = tenantInfos.flatMap((tenantInfo) => {
      const clonedTenantInfo = cloneDeep(tenantInfo)
      clonedTenantInfo.tenant.id = getFullTenantId(tenantInfo.tenant.id, true)
      return [tenantInfo, clonedTenantInfo]
    })

    for (const tenantInfo of tenantInfos) {
      console.info(
        `Migrating tenant ${tenantInfo.tenant.name} (ID: ${tenantInfo.tenant.id})`
      )
      await withContext(async () => {
        await initializeTenantContext(tenantInfo.tenant.id)
        await migrationCallback(tenantInfo.tenant, tenantInfo.auth0Domain)
      })
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
    const settings = await tenantRepository.getTenantSettings(['features'])
    if (!settings.features) {
      return
    }
    await tenantRepository.createOrUpdateTenantSettings({
      features: settings.features.filter((feature) =>
        FEATURES.includes(feature as Feature)
      ),
    })
  })
}
export async function renameFeatureFlags(mappings: {
  [oldFeatureName: string]: Feature
}) {
  await migrateAllTenants(async (tenant: Tenant) => {
    const dynamoDb = await getDynamoDbClient()
    const tenantRepository = new TenantRepository(tenant.id, {
      dynamoDb,
    })
    const settings = await tenantSettings(tenant.id)
    if (!settings.features) {
      return
    }
    await tenantRepository.createOrUpdateTenantSettings({
      features: settings.features.map(
        (feature) => mappings[feature] ?? feature
      ),
    })
  })
}
