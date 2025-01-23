import { min } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantBasic } from '@/services/accounts'
import { ApiUsageMetricsService } from '@/services/metrics/api-usage-metrics-service'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { isDemoTenant } from '@/utils/tenant'
import { SheetsApiUsageMetricsService } from '@/services/metrics/sheets-api-usage-metrics-service'
import { DailyMetricStats, MonthlyMetricStats } from '@/services/metrics/utils'
import { Tenant } from '@/services/accounts/repository'

type TimeRange = { startTimestamp: number; endTimestamp: number }

async function publishToGoogleSheets(
  tenantInfo: TenantBasic,
  googleSheetIds: string[],
  dailyMetrics: DailyMetricStats[],
  monthlyMetrics: MonthlyMetricStats[]
) {
  for (const sheetId of googleSheetIds) {
    const sheetsService = new SheetsApiUsageMetricsService(tenantInfo, sheetId)
    await sheetsService.initialize()
    await sheetsService.updateUsageMetrics(dailyMetrics, monthlyMetrics)
  }
}

async function migrateTenant(tenant: Tenant) {
  if (isDemoTenant(tenant.id)) {
    logger.info('Skipping demo tenant...')
    return
  }
  const tenantInfo: TenantBasic = {
    id: tenant.id,
    name: tenant.name,
  }
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const apiMetricsService = new ApiUsageMetricsService({
    mongoDb,
    dynamoDb,
  })
  logger.info('Getting daily metrics...')
  const googleSheetIds = [
    process.env.API_USAGE_GOOGLE_SHEET_ID as string,
  ].filter(Boolean)
  for (let i = 5; i >= 0; i--) {
    const month = dayjs().subtract(i, 'month').format('YYYY-MM')
    const timeRange: TimeRange = {
      startTimestamp: dayjs(month).startOf('month').valueOf(),
      endTimestamp:
        min([dayjs(month).endOf('month').valueOf(), Date.now()]) || Date.now(),
    }
    const dailyValues = await apiMetricsService.getDailyMetricValues(
      tenantInfo,
      timeRange
    )
    const monthlyMetrics = apiMetricsService.getMonthlyMetricValues(dailyValues)

    logger.info(`Publishing to Google Sheet for ${month} and ${tenant.id}`)
    await publishToGoogleSheets(tenantInfo, googleSheetIds, [], monthlyMetrics)
    logger.info(`Published to Google Sheet for ${month} and ${tenant.id}`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
