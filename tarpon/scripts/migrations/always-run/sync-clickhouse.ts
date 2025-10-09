import { backOff } from 'exponential-backoff'
import { migrateAllTenants } from '../utils/tenant'
import { createTenantDatabase } from '@/utils/clickhouse/database'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'

export async function syncClickhouseTables() {
  if (isClickhouseEnabledInRegion()) {
    await migrateAllTenants(async (tenant) => {
      // retry 3 times
      await backOff(() => createTenantDatabase(tenant.id), {
        retry(e: Error, attemptNumber: number) {
          if (attemptNumber > 3) {
            return false
          }

          if (
            e.message.toLowerCase().includes('timeout') ||
            e.message.toLowerCase().includes('zookeeper')
          ) {
            return true
          }
          return false
        },
        numOfAttempts: 3,
        maxDelay: 10000,
        timeMultiple: 2,
        jitter: 'full',
      })
    })
  }
}
