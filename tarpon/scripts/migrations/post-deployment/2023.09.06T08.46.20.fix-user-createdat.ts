import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'

const TWO_DAYS_MS = 1000 * 60 * 60 * 48

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  await db.collection(USERS_COLLECTION(tenant.id)).updateMany(
    {
      $or: [
        {
          $expr: {
            $gt: ['$createdAt', { $add: ['$createdTimestamp', TWO_DAYS_MS] }],
          },
        },
        { createdAt: { $exists: false } },
      ],
    },
    [{ $set: { createdAt: '$createdTimestamp' } }]
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
