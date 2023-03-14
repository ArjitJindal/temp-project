import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { Tenant } from '@/services/accounts'
import {
  DRS_SCORES_COLLECTION,
  USERS_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const drsScoresCollectionName = DRS_SCORES_COLLECTION(tenant.id)
  const drsScoresCollection = db.collection(drsScoresCollectionName)
  const usersCollectionName = USERS_COLLECTION(tenant.id)
  const usersCollection = db.collection(usersCollectionName)

  const drsScores = await drsScoresCollection
    .aggregate([
      { $sort: { createdAt: -1, userId: 1 } },
      { $group: { _id: '$userId', latestDrsScore: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$latestDrsScore' } },
      { $match: { transactionId: 'MANUAL_UPDATE' } },
    ])
    .toArray()

  for await (const drsScore of drsScores) {
    await usersCollection.findOneAndUpdate(
      { userId: drsScore.userId },
      { $set: { drsScore } }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
