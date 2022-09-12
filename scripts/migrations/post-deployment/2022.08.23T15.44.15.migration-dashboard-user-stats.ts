import { MigrationFn } from 'umzug'
import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  console.log(`Migrate ${tenant.name} (#${tenant.id})`)
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const aggregationCollection = mongodb
    .db()
    .collection(DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenant.id))

  try {
    await aggregationCollection.dropIndex('date_-1_originUserId_-1')
  } catch (e) {
    // ignore
  }
  const result = await aggregationCollection.updateMany(
    { originUserId: { $exists: true } },
    { $set: { direction: 'ORIGIN' }, $rename: { originUserId: 'userId' } }
  )
  console.log(`Updated ${result.modifiedCount} documents`)

  await aggregationCollection.createIndex(
    {
      direction: 1,
      date: -1,
      userId: 1,
    },
    {
      unique: true,
    }
  )
}

export const up: MigrationFn = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down: MigrationFn = async () => {
  // skip
}
