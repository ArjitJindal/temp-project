import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { UserStats } from '@/services/analytics/dashboard-metrics/user-stats'
import {
  DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_DAILY,
  DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_HOURLY,
  DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_MONTHLY,
  DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_DAILY,
  DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_HOURLY,
  DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_MONTHLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
} from '@/utils/mongodb-definitions'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'

async function replaceObjectId(collection: string) {
  const db = await getMongoDbClientDb()
  const allDocsToMigrate = db
    .collection(collection)
    .find({ _id: { $type: 'string' } })
  for await (const doc of allDocsToMigrate) {
    await db.collection(collection).insertOne({ ...doc, _id: undefined })
  }
  await db.collection(collection).deleteMany({ _id: { $type: 'string' } })
}

async function migrateTenant(tenant: Tenant) {
  const collections = [
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenant.id),
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenant.id),
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenant.id),
    DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_HOURLY(tenant.id),
    DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_DAILY(tenant.id),
    DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_MONTHLY(tenant.id),
    DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_HOURLY(tenant.id),
    DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_DAILY(tenant.id),
    DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_MONTHLY(tenant.id),
  ]
  const db = await getMongoDbClientDb()
  for (const collection of collections) {
    await db.collection(collection).updateMany({ _id: { $type: 'string' } }, [
      {
        $addFields: {
          time: '$_id',
        },
      },
    ])
    await replaceObjectId(collection)
    await db.collection(collection).createIndex(
      {
        time: 1,
        ready: 1,
      },
      {
        unique: true,
      }
    )
  }
  await UserStats.refresh(tenant.id)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
