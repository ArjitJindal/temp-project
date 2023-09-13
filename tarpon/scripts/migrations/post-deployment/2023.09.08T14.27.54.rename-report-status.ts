import { migrateAllTenants } from '../utils/tenant'
import { Report } from '@/@types/openapi-internal/Report'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { REPORT_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const collection = db.collection<Report>(REPORT_COLLECTION(tenant.id))
  await collection.updateMany(
    { status: 'COMPLETE' },
    { $set: { status: 'COMPLETE' } }
  )
  await collection.updateMany(
    { status: 'DRAFT' },
    { $set: { status: 'DRAFT' } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
