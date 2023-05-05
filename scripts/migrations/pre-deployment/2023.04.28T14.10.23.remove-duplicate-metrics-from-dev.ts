import { migrateAllTenants } from '../utils/tenant'
import { METRICS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { ApiUsageMetrics } from '@/lambdas/cron-job-midnight/services/api-usage-metrics-service'

async function migrateTenant(tenant: Tenant) {
  if (process.env.ENV !== 'dev') {
    return
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const metricsCollection = db.collection<ApiUsageMetrics>(
    METRICS_COLLECTION(tenant.id)
  )
  // remove duplicate entries
  const allMetrics = await metricsCollection.find({}).toArray()
  // if union of name startTimestamp and endTimestamp is unique, remove duplicates
  const uniqueMetrics = allMetrics.filter(
    (metric, index, self) =>
      index ===
      self.findIndex(
        (m) =>
          m.name === metric.name &&
          m.startTimestamp === metric.startTimestamp &&
          m.endTimestamp === metric.endTimestamp
      )
  )

  await metricsCollection.deleteMany({})
  await metricsCollection.insertMany(uniqueMetrics)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
