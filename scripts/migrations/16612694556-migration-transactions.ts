import { exit } from 'process'
import { TarponStackConstants } from '@cdk/constants'
import { getMongoDbClient } from './utils/db'
import { getConfig } from './utils/config'
import { AccountsConfig } from '@/lambdas/phytoplankton-internal-api-handlers/app'
import {
  AccountsService,
  Tenant,
} from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY } from '@/utils/mongoDBUtils'

const config = getConfig()

async function migrateTenant(tenant: Tenant) {
  console.log(`Migrate ${tenant.name} (#${tenant.id})`)
  const mongodb = await getMongoDbClient(
    TarponStackConstants.MONGO_DB_DATABASE_NAME
  )
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

async function main() {
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )
  const tenants = await accountsService.getTenants()

  for (const tenant of tenants) {
    await migrateTenant(tenant)
  }
}

main()
  .then(() => {
    console.info('Migration completed.')
    exit(0)
  })
  .catch((e) => {
    console.error(e)
    exit(1)
  })
