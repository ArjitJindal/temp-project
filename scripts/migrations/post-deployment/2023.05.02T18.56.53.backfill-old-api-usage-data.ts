import { migrateAllTenants } from '../utils/tenant'
import { METRICS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { ApiUsageMetrics } from '@/lambdas/cron-job-midnight/services/api-usage-metrics-service'
import { SheetsApiUsageMetricsService } from '@/lambdas/cron-job-midnight/services/sheets-api-usage-metrics-service'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = await mongoDb.db()
  const metricsCollectionName = METRICS_COLLECTION(tenant.id)
  const metricsCollection = db.collection<ApiUsageMetrics>(
    metricsCollectionName
  )

  const apiUsageMetrics = await metricsCollection.find({}).toArray()
  const distinctStartTimestamps = [
    ...new Set(apiUsageMetrics.map((metric) => metric.startTimestamp)),
  ]
  const timestamps: { startTimestamp: number; endTimestamp: number }[] = []

  for (const startTimestamp of distinctStartTimestamps) {
    const endTimestamp = apiUsageMetrics.find(
      (metric) => metric.startTimestamp === startTimestamp
    )?.endTimestamp
    if (endTimestamp) {
      timestamps.push({ startTimestamp, endTimestamp })
    }
  }

  const sheetsService = new SheetsApiUsageMetricsService(tenant, {
    mongoDb,
  })

  await sheetsService.initialize()

  for (const { startTimestamp, endTimestamp } of timestamps) {
    await sheetsService.updateUsageMetrics(startTimestamp, endTimestamp)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
