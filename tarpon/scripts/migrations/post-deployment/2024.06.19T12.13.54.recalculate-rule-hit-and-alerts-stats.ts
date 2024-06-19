import { migrateAllTenants } from '../utils/tenant'
import { TimeRange } from '../../../src/services/dashboard/repositories/types'
import { RuleHitsStatsDashboardMetric } from '../../../src/services/analytics/dashboard-metrics/rule-stats'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { Tenant } from '@/services/accounts'
import dayjs from '@/utils/dayjs'
import { DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY } from '@/utils/mongodb-definitions'
import { getMongoDbClientDb, getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const tenantId = tenant.id
  const collection = db.collection(
    DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
  )
  await collection.deleteMany({})

  const mongoDb = await getMongoDbClient()
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })

  await dashboardStatsRepository.recalculateRuleHitAlertsStats()
  await dashboardStatsRepository.refreshAlertsStats()
  await dashboardStatsRepository.refreshQaStats()

  const migrationKey = `2024.06.19T12.13.54.recalculate-rule-hit-and-alerts-stats__${tenantId}`
  const lastCompletedTimestamp =
    (await getMigrationLastCompletedTimestamp(migrationKey)) ??
    Number.MAX_SAFE_INTEGER
  const now = dayjs('2024-06-22')
  const targetTimeRanges: TimeRange[] = [
    {
      endTimestamp: now.valueOf(),
      startTimestamp: now.subtract(1, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(1, 'month').valueOf(),
      startTimestamp: now.subtract(2, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(2, 'month').valueOf(),
      startTimestamp: now.subtract(3, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(3, 'month').valueOf(),
      startTimestamp: now.subtract(4, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(4, 'month').valueOf(),
      startTimestamp: now.subtract(5, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(5, 'month').valueOf(),
      startTimestamp: now.subtract(6, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(6, 'month').valueOf(),
      startTimestamp: now.subtract(7, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(7, 'month').valueOf(),
      startTimestamp: now.subtract(8, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(8, 'month').valueOf(),
      startTimestamp: now.subtract(9, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(9, 'month').valueOf(),
      startTimestamp: now.subtract(10, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(10, 'month').valueOf(),
      startTimestamp: now.subtract(11, 'month').valueOf(),
    },
    {
      endTimestamp: now.subtract(11, 'month').valueOf(),
      startTimestamp: now.subtract(12, 'month').valueOf(),
    },
  ].filter((timeRange) => timeRange.startTimestamp < lastCompletedTimestamp)
  for (const timeRange of targetTimeRanges) {
    await RuleHitsStatsDashboardMetric.refreshTransactionsStats(
      tenant.id,
      timeRange
    )
    await updateMigrationLastCompletedTimestamp(
      migrationKey,
      timeRange.startTimestamp as number
    )
    logger.info(
      `Migrated tenant ${tenant.id} for time range ${timeRange.startTimestamp} - ${timeRange.endTimestamp}`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
