import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { ALERTS_QA_SAMPLING_COLLECTION } from '@/utils/mongodb-definitions'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const collectionName = ALERTS_QA_SAMPLING_COLLECTION(tenant.id)

  const db = mongoDb.db()

  const collection = db.collection<AlertsQaSampling>(collectionName)

  const cursor = collection.find({})

  for await (const doc of cursor) {
    const { alertIds } = doc

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: { samplingQuantity: alertIds?.length ?? 0 },
        $unset: { samplingPercentage: '' },
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
