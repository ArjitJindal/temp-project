import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import {
  DRS_SCORES_COLLECTION,
  getMongoDbClient,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const drsScoresCollectionName = DRS_SCORES_COLLECTION(tenant.id)
  const usersCollectionName = USERS_COLLECTION(tenant.id)

  const drsScoresCollection = db.collection(drsScoresCollectionName)
  const usersCollection = db.collection(usersCollectionName)

  const drsScores = await drsScoresCollection
    .aggregate([
      { $sort: { createdAt: -1, userId: 1 } },
      { $group: { _id: '$userId', latestDrsScore: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$latestDrsScore' } },
    ])
    .toArray()

  console.log(
    `Found ${drsScores.length} scores for tenant ${tenant.id}`,
    drsScores
  )

  for (const drsScore of drsScores) {
    const user = await usersCollection.findOne({ userId: drsScore.userId })

    if (_.isEmpty(user?.drsScore)) {
      await usersCollection.updateOne(
        { userId: drsScore.userId },
        { $set: { drsScore } }
      )
      console.log(
        `Updated  for tenant ${tenant.id} with latest DRS score for user ${drsScore.userId}`
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
