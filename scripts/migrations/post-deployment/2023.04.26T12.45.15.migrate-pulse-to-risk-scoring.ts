import { migrateAllTenants } from '../utils/tenant'
import { AUDITLOG_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const mongoDb = await getMongoDbClient()
  const auditLogCollectionName = AUDITLOG_COLLECTION(tenantId)
  const db = mongoDb.db()
  const auditLogCollection = db.collection(auditLogCollectionName)
  await auditLogCollection.updateMany(
    { type: 'PULSE' },
    { $set: { type: 'RISK_SCORING' } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
