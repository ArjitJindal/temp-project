import { Filter } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { AUDITLOG_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection<AuditLog>(AUDITLOG_COLLECTION(tenant.id))
  const deletionFilter: Filter<AuditLog> = {
    category: 'ACTIVITY_LOG',
    subtype: 'CREATION',
    type: 'CASE',
  }
  const deletionResult = await collection.deleteMany(deletionFilter)

  console.log(
    `${deletionResult.deletedCount} records deleted for tenant ${tenant.id}`
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
