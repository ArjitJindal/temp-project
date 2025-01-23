import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AUDITLOG_COLLECTION } from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts/repository'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const auditLogCollection = db.collection(AUDITLOG_COLLECTION(tenant.id))
  await auditLogCollection.updateMany(
    { 'user.id': { $exists: false } },
    { $set: { user: { id: FLAGRIGHT_SYSTEM_USER } } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
