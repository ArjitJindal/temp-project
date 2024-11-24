import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { JOBS_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  await db.collection(JOBS_COLLECTION(tenant.id)).updateMany(
    {
      type: 'RISK_SCORING_RECALCULATION',
      'parameters.userIds': null,
    },
    {
      $set: {
        'parameters.userIds': [],
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
