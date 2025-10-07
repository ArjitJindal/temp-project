import { migrateAllTenants } from '../utils/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Tenant } from '@/@types/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { SanctionsSettingsProviderScreeningTypes } from '@/@types/openapi-internal/SanctionsSettingsProviderScreeningTypes'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'pnb') {
    return
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  const newSettings: SanctionsSettingsProviderScreeningTypes = {
    provider: 'dowjones',
    screeningTypes: ['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'],
    entityTypes: ['PERSON'],
  }
  const { sanctions } = await tenantRepository.getTenantSettings(['sanctions'])

  await tenantRepository.createOrUpdateTenantSettings({
    sanctions: {
      ...(sanctions ?? {}),
      providerScreeningTypes: [newSettings],
    },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
