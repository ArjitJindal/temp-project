import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { envIs } from '@/utils/env'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Feature } from '@/@types/openapi-internal/Feature'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('sandbox')) {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })

  const tenantSettings = await tenantRepository.getTenantSettings(['features'])

  const features: Feature[] = [
    ...new Set([
      ...((tenantSettings.features ?? []) as Feature[]),
      'RISK_SCORING',
      'RISK_LEVELS',
    ] as Feature[]),
  ]

  await tenantRepository.createOrUpdateTenantSettings({
    features,
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
