import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { REASONS_COLLECTION } from '@/utils/mongodb-definitions'
import { ConsoleActionReason } from '@/@types/openapi-internal/ConsoleActionReason'
import { ReasonsService } from '@/services/tenants/reasons-service'
import { CASE_REASONSS } from '@/@types/openapi-internal-custom/CaseReasons'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection<ConsoleActionReason>(
    REASONS_COLLECTION(tenant.id)
  )
  await collection.deleteMany({ reason: { $in: CASE_REASONSS } })
  const reasonsService = new ReasonsService(tenant.id, mongoDb)
  await reasonsService.initialiseDefaultReasons()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
