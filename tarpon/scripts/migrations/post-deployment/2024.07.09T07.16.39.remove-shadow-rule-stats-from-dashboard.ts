import { migrateAllTenants } from '../utils/tenant'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { RuleHitsStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/rule-stats'
import { Tenant } from '@/services/accounts'
import { HitsByUserStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/hits-by-user-stats'
import dayjs from '@/utils/dayjs'
import { TimeRange } from '@/services/dashboard/repositories/types'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const migrationKey = `2024.07.09T07.16.39.remove-shadow-rule-stats-from-dashboard__${tenantId}`
  const startDate = dayjs('2024-04-27')
  const lastCompletedTimestamp =
    (await getMigrationLastCompletedTimestamp(migrationKey)) ??
    Number.MAX_SAFE_INTEGER
  const timeWindows: TimeRange[] = [
    {
      startTimestamp: startDate.add(2, 'month').valueOf(),
      endTimestamp: Date.now(),
    },
    {
      startTimestamp: startDate.add(1, 'month').valueOf(),
      endTimestamp: startDate.add(2, 'month').valueOf(),
    },
    {
      startTimestamp: startDate.valueOf(),
      endTimestamp: startDate.add(1, 'month').valueOf(),
    },
  ].filter((timeWindow) => timeWindow.startTimestamp < lastCompletedTimestamp)
  for (const timeWindow of timeWindows) {
    await RuleHitsStatsDashboardMetric.refreshTransactionsStats(
      tenant.id,
      timeWindow
    )
    await HitsByUserStatsDashboardMetric.refreshTransactionsStats(
      tenant.id,
      'ORIGIN',
      timeWindow
    )
    await HitsByUserStatsDashboardMetric.refreshTransactionsStats(
      tenant.id,
      'DESTINATION',
      timeWindow
    )
    await updateMigrationLastCompletedTimestamp(
      migrationKey,
      timeWindow.startTimestamp as number
    )
    logger.info(
      `Migrated tenant ${tenant.id} for time range ${timeWindow.startTimestamp} - ${timeWindow.endTimestamp}`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
