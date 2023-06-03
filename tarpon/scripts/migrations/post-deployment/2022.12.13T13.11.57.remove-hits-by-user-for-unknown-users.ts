import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { UserRepository } from '@/services/users/repositories/user-repository'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const userRepository = new UserRepository(tenant.id, { mongoDb })
  const dashboardHitsByUserCollection = mongoDb
    .db()
    .collection(DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenant.id))
  const userIds = await dashboardHitsByUserCollection.distinct('userId')
  const unknownUserIds = new Set()
  for (const userId of userIds) {
    if (!(await userRepository.getUserById(userId))) {
      unknownUserIds.add(userId)
    }
  }
  if (unknownUserIds.size > 0) {
    await dashboardHitsByUserCollection.deleteMany({
      userId: { $in: Array.from(unknownUserIds) },
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
