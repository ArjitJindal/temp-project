import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === 'pnb') {
    const db = await getMongoDbClientDb()
    const sanctionsSearchesCollection = db.collection(
      SANCTIONS_SEARCHES_COLLECTION(tenant.id)
    )
    await sanctionsSearchesCollection.deleteMany({
      'request.manualSearch': { $ne: true },
      'response.hitsCount': { $eq: 0 },
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
