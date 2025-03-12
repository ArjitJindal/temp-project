import { backOff } from 'exponential-backoff'
import { syncClickhouseTableWithMongo } from '../utils/clickhouse'
import { ClickHouseTables } from '@/utils/clickhouse/definition'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { getDynamoDbClient } from '@/utils/dynamodb'

export const up = async () => {
  logger.info('Starting MongoDB to Clickhouse sync migration')
  const mongoClient = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const tenantId = '0789ad73b8'
  // Sync each table with retry logic
  for (const table of ClickHouseTables) {
    try {
      logger.info(
        `Starting sync for table ${table.table} - Tenant: ${tenantId}`
      )

      await backOff(
        () =>
          syncClickhouseTableWithMongo(mongoClient, dynamoDb, tenantId, table),
        {
          numOfAttempts: 3,
          maxDelay: 10000,
          timeMultiple: 2,
          jitter: 'full',
          retry(e: Error, attemptNumber: number) {
            logger.error(
              `Failed attempt ${attemptNumber} for table ${table.table}:`,
              e
            )
            return attemptNumber <= 3
          },
        }
      )

      logger.info(
        `Completed sync for table ${table.table} - Tenant: ${tenantId}`
      )
    } catch (error) {
      logger.error(
        `Failed to sync table ${table.table} for tenant ${tenantId}:`,
        error
      )
      continue
    }
  }
  logger.info('Completed MongoDB to Clickhouse sync migration')
}

export const down = async () => {}
