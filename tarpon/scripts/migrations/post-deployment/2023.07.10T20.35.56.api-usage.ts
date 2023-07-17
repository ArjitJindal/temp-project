import { migrateAllTenants } from '../utils/tenant'
import { METRICS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { ApiUsageMetrics } from '@/services/metrics/api-usage-metrics-service'
import dayjs from '@/utils/dayjs'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const collection = db.collection<ApiUsageMetrics>(
    METRICS_COLLECTION(tenant.id)
  )
  for await (const doc of collection.find({
    startTimestamp: { $exists: true },
  })) {
    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          date: dayjs((doc as any).startTimestamp).format('YYYY-MM-DD'),
        },
        $unset: {
          startTimestamp: '',
          endTimestamp: '',
        },
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
