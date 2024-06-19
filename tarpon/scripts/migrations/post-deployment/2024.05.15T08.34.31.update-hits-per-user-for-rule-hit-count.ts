import { migrateAllTenants } from '../utils/tenant'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { Tenant } from '@/services/accounts'
import { HitsByUserStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/hits-by-user-stats'
import { TimeRange } from '@/services/dashboard/repositories/types'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const migrationKey = `2024.05.15T08.34.31.update-hits-per-user-for-rule-hit-count__${tenant.id}`
  const lastCompletedTimestamp =
    (await getMigrationLastCompletedTimestamp(migrationKey)) ??
    Number.MAX_SAFE_INTEGER
  const now = dayjs('2024-05-16')
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
  ].filter((timeRange) => timeRange.startTimestamp < lastCompletedTimestamp)
  for (const timeRange of targetTimeRanges) {
    await Promise.all([
      HitsByUserStatsDashboardMetric.refreshAlertsStats(
        tenant.id,
        'ORIGIN',
        timeRange
      ),
      HitsByUserStatsDashboardMetric.refreshAlertsStats(
        tenant.id,
        'DESTINATION',
        timeRange
      ),
      HitsByUserStatsDashboardMetric.refreshTransactionsStats(
        tenant.id,
        'ORIGIN',
        timeRange
      ),
      HitsByUserStatsDashboardMetric.refreshTransactionsStats(
        tenant.id,
        'DESTINATION',
        timeRange
      ),
    ])
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
