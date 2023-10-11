import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { AUDITLOG_COLLECTION } from '@/utils/mongodb-definitions'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const auditLogCollection = db.collection<AuditLog>(
    AUDITLOG_COLLECTION(tenant.id)
  )

  await auditLogCollection.updateMany(
    {
      action: 'UPDATE',
      type: {
        $in: ['ALERT', 'CASE'],
      },
      subtype: null as any,
    },
    { $set: { subtype: 'STATUS_CHANGE' } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
