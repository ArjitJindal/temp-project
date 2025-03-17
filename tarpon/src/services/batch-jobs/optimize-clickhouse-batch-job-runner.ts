import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { TenantService } from '../tenants'
import { BatchJobRunner } from './batch-job-runner-base'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { logger } from '@/core/logger'

export class OptimizeClickhouseBatchJobRunner extends BatchJobRunner {
  async run() {
    const allTenants = await TenantService.getAllTenants(
      process.env.ENV as Stage,
      process.env.REGION as FlagrightRegion
    )
    for (const tenant of allTenants) {
      for (const table of ClickHouseTables) {
        const clickhouseClient = await getClickhouseClient(tenant.tenant.id)
        try {
          await clickhouseClient.exec({
            query: `OPTIMIZE TABLE ${table.table} FINAL`,
            clickhouse_settings: { async_insert: 1, wait_for_async_insert: 0 },
          })
        } catch (e) {
          logger.warn(
            `Failed to optimize clickhouse table: ${(e as Error)?.message}`,
            e
          )
        }
        try {
          await clickhouseClient.exec({
            query: `DELETE from ${table.table} where timestamp = 0`,
            clickhouse_settings: { async_insert: 1, wait_for_async_insert: 0 },
          })
        } catch (e) {
          logger.error(
            `Failed to delete clickhouse table: ${(e as Error)?.message}`,
            e
          )
        }
      }
    }
  }
}
