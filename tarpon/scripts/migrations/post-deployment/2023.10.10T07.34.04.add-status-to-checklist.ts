import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { ChecklistTemplate } from '@/@types/openapi-internal/ChecklistTemplate'
import { CHECKLIST_TEMPLATE_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection<ChecklistTemplate>(
    CHECKLIST_TEMPLATE_COLLECTION(tenant.id)
  )
  await collection.updateMany({}, [{ $set: { status: 'ACTIVE' } }])
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
