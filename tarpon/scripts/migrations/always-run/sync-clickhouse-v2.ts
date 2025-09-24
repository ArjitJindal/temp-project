import { backOff } from 'exponential-backoff'
import { migrateAllTenants } from '../utils/tenant'
import {
  isClickhouseEnabledInRegion,
  createOrUpdateClickHouseTable,
} from '@/utils/clickhouse/utils'
import { ClickHouseChecksumService } from '@/services/clickhouse-checksum/service'
import { ClickHouseTableChecksum } from '@/utils/clickhouse-checksum'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { logger } from '@/core/logger'

export async function syncClickhouseTables() {
  if (!isClickhouseEnabledInRegion()) {
    logger.info('ClickHouse is not enabled in this region, skipping sync')
    return
  }

  await migrateAllTenants(async (tenant) => {
    const tenantId = tenant.id
    const clickhouseChecksumService = new ClickHouseChecksumService()
    const analysis = await clickhouseChecksumService.analyzeTenantSyncNeeds(
      tenantId
    )

    if (!analysis.needsSync) {
      logger.info(
        `ClickHouse sync skipped for tenant ${tenantId} - no changes detected`
      )
      return
    }

    logger.info(`ClickHouse sync needed for tenant ${tenantId}:`)
    logger.info(`  Tables to create: ${analysis.tablesToCreate.length}`)
    logger.info(`  Tables to sync: ${analysis.tablesToSync.length}`)
    logger.info(`  Tables to remove: ${analysis.tablesToRemove.length}`)
    logger.info(`  Tables to skip: ${analysis.tablesToSkip.length}`)

    await backOff(
      async () => {
        await performSelectiveSync(tenantId, analysis)
        logger.info(`ClickHouse sync completed for tenant ${tenantId}`)
      },
      {
        retry(e: Error, attemptNumber: number) {
          if (attemptNumber > 3) {
            return false
          }

          if (
            e.message.toLowerCase().includes('timeout') ||
            e.message.toLowerCase().includes('zookeeper')
          ) {
            logger.warn(
              `ClickHouse sync attempt ${attemptNumber} failed for tenant ${tenantId}: ${e.message}`
            )
            return true
          }
          return false
        },
        numOfAttempts: 3,
        maxDelay: 10000,
        timeMultiple: 2,
        jitter: 'full',
      }
    )
  })
}

async function performSelectiveSync(
  tenantId: string,
  analysis: {
    tablesToCreate: string[]
    tablesToSync: string[]
    tablesToRemove: string[]
    tablesToSkip: string[]
  }
) {
  const clickhouseChecksumService = new ClickHouseChecksumService()
  const tablesToProcess = [...analysis.tablesToCreate, ...analysis.tablesToSync]

  if (tablesToProcess.length === 0) {
    logger.info(`No tables to sync for tenant ${tenantId}`)
    return
  }

  for (const tableName of tablesToProcess) {
    const table = ClickHouseTables.find((t) => t.table === tableName)
    if (!table) {
      logger.warn(`Table definition not found for ${tableName}, skipping`)
      continue
    }

    logger.info(`Syncing table ${tableName} for tenant ${tenantId}`)

    try {
      await createOrUpdateClickHouseTable(tenantId, table, {
        skipDefaultClient: true,
      })

      const checksumResult =
        clickhouseChecksumService.generateSingleTableChecksum(tableName)
      const tableChecksum: ClickHouseTableChecksum = {
        tableName,
        checksum: checksumResult?.checksum || '',
        lastUpdated: Date.now(),
      }
      await clickhouseChecksumService.updateTableChecksums(tenantId, [
        tableChecksum,
      ])

      logger.info(
        `Successfully synced table ${tableName} for tenant ${tenantId}`
      )
    } catch (error) {
      logger.error(
        `Failed to sync table ${tableName} for tenant ${tenantId}:`,
        error
      )
      throw error
    }
  }
}
