import { Filter } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AUDITLOG_COLLECTION } from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection<AuditLog>(AUDITLOG_COLLECTION(tenant.id))
  const deletionFilter: Filter<AuditLog> = {
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
