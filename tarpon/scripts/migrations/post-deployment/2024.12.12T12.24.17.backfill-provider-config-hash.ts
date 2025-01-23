import { migrateAllTenants } from '../utils/tenant'
import { hasFeature } from '@/core/utils/context'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { generateChecksum } from '@/utils/object'

async function migrateTenant(tenant: Tenant) {
  if (hasFeature('DOW_JONES')) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    mongoDb,
    dynamoDb: getDynamoDbClient(),
  })
  const { sanctions } = await tenantRepository.getTenantSettings()
  const hasInitialScreening = !!sanctions?.customInitialSearchProfileId
  if (hasInitialScreening) {
    return
  }
  const collection = mongoDb
    .db()
    .collection(SANCTIONS_SEARCHES_COLLECTION(tenant.id))
  await collection.updateMany(
    {},
    {
      $set: {
        providerConfigHash: generateChecksum({
          stage: 'ONGOING',
        }),
      },
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
