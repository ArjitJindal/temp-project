import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import { AUDITLOG_COLLECTION } from '@/utils/mongo-table-names'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection(AUDITLOG_COLLECTION(tenant.id))

  // Update all documents where type is 'ACCOUNT' to 'TENANT'
  await collection.updateMany({ type: 'ACCOUNT' }, { $set: { type: 'TENANT' } })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // If needed, we could revert TENANT back to ACCOUNT here
  // skip for now as specified
}
