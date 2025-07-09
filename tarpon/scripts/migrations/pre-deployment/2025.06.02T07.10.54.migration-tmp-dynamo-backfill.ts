import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { MIGRATION_TMP_COLLECTION } from '@/utils/mongodb-definitions'
import { saveMigrationTmpProgressToDynamo } from '@/utils/migration-progress'
import { isDemoTenant } from '@/utils/tenant'

async function migrateTenant(tenant: Tenant) {
  if (isDemoTenant(tenant.id)) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection(MIGRATION_TMP_COLLECTION)
  await processCursorInBatch(
    collection.find({}),
    async (migrationTmp) => {
      await saveMigrationTmpProgressToDynamo(migrationTmp)
    },
    { mongoBatchSize: 1000, processBatchSize: 1000, debug: true }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
