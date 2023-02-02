import { migrateAllTenants } from '../utils/tenant'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import {
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
  USERS_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'

const syncKrsAndDrsScores = async (tenant: Tenant) => {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const krsCollection = db.collection<KrsScore>(
    KRS_SCORES_COLLECTION(tenant.id)
  )
  const drsCollection = db.collection<DrsScore>(
    DRS_SCORES_COLLECTION(tenant.id)
  )
  const usersCollection = db.collection<InternalUser>(
    USERS_COLLECTION(tenant.id)
  )

  const usersWithNoKrsAndDrs = await usersCollection
    .find({
      $or: [{ krsScore: { $exists: false } }, { drsScore: { $exists: false } }],
    })
    .sort({ createdTimestamp: -1 })

  for await (const user of usersWithNoKrsAndDrs) {
    const krsScore = await krsCollection.findOne({ userId: user.userId })
    const drsScore = await drsCollection.findOne({ userId: user.userId })

    console.log(
      `Found KRS score ${krsScore?.krsScore} and DRS score ${drsScore?.drsScore} for user ${user.userId}`
    )

    if (!krsScore && !drsScore) {
      continue
    }

    await usersCollection.updateOne(
      { userId: user.userId },
      {
        $set: {
          ...(krsScore && { krsScore }),
          ...(drsScore && { drsScore }),
        },
      }
    )
  }
}

export async function syncKrsAndDrsScoresForAllTenants() {
  console.log('Syncing KRS and DRS scores for all tenants')
  await migrateAllTenants(syncKrsAndDrsScores)
}

if (require.main === module) {
  syncKrsAndDrsScoresForAllTenants()
}
