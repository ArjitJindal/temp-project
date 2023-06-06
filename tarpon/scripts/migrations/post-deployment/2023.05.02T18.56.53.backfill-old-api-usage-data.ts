import { migrateAllTenants } from '../utils/tenant'
import { METRICS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import {
  ApiUsageMetrics,
  ApiUsageMetricsService,
} from '@/services/metrics/api-usage-metrics-service'
import { SheetsApiUsageMetricsService } from '@/services/metrics/sheets-api-usage-metrics-service'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
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

  const timestampsByMonth: {
    [month: string]: { startTimestamp: number; endTimestamp: number }[]
  } = {}

  for (const { startTimestamp, endTimestamp } of timestamps) {
    const month = new Date(startTimestamp).getMonth()
    if (!timestampsByMonth[month]) {
      timestampsByMonth[month] = []
    }
    timestampsByMonth[month].push({ startTimestamp, endTimestamp })
  }

  for (const month in timestampsByMonth) {
    const timestamps = timestampsByMonth[month]
    const startTimestamp = timestamps[0].startTimestamp
    const endTimestamp = timestamps[0].endTimestamp

    const apiUsageMetricsService = new ApiUsageMetricsService(
      tenant,
      { mongoDb, dynamoDb },
      { startTimestamp, endTimestamp }
    )

    for (const { startTimestamp, endTimestamp } of timestamps) {
      const sheetsApiUsageMetricsService = new SheetsApiUsageMetricsService(
        tenant,
        { mongoDb },
        await apiUsageMetricsService.getMonthlyData(),
        { startTimestamp, endTimestamp }
      )
      await sheetsApiUsageMetricsService.initialize()
      await sheetsApiUsageMetricsService.updateUsageMetrics()
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
