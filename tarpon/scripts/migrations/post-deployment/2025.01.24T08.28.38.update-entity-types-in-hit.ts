import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/utils/context'
import { Tenant } from '@/@types/tenant'
import { SANCTIONS_HITS_COLLECTION } from '@/utils/mongo-table-names'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const tenantHasFeatureScreening = tenantHasFeature(tenantId, 'SANCTIONS')
  if (!tenantHasFeatureScreening) {
    return
  }
  const db = await getMongoDbClientDb()
  const hitsCollection = db.collection(SANCTIONS_HITS_COLLECTION(tenantId))
  await hitsCollection.updateMany(
    {
      'entity.entityType': { $in: ['Person', 'person'] },
    },
    {
      $set: { 'entity.entityType': 'PERSON' },
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
