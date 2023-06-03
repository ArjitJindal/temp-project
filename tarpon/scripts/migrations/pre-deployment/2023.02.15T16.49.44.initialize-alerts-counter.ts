import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { COUNTER_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { EntityCounter } from '@/@types/openapi-internal/EntityCounter'

export async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const db = mongodb.db()
  const counterCollection = db.collection<EntityCounter>(
    COUNTER_COLLECTION(tenant.id)
  )
  await counterCollection.findOneAndUpdate(
    { entity: 'Alert' },
    { $inc: { count: 1 } },
    { upsert: true, returnDocument: 'after' }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // Put your migration code for rolling back here. If not applicable, skip it.
}
