import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import {
  getMongoDbClient,
  KRS_SCORES_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const krsCollection = db.collection<KrsScore>(
    KRS_SCORES_COLLECTION(tenant.id)
  )
  const usersCollection = db.collection(USERS_COLLECTION(tenant.id))
  const cursor = await krsCollection.find()

  for await (const krsScore of cursor) {
    await usersCollection.updateOne(
      { userId: krsScore.userId },
      {
        $set: { krsScore },
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
