import { getMongoDbClient, allCollections } from '@/utils/mongodb-utils'
import { TENANT_DELETION_COLLECTION } from '@/utils/mongo-table-names'
import { DeleteTenant } from '@/@types/openapi-internal/DeleteTenant'
import { executeClickhouseDefaultClientQuery } from '@/utils/clickhouse/execute'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { logger } from '@/core/logger'
import { getClickhouseDbName } from '@/utils/clickhouse/database-utils'

export const up = async () => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  // Get all deleted tenants
  const deletedTenants = await db
    .collection<DeleteTenant>(TENANT_DELETION_COLLECTION)
    .find({})
    .toArray()

  logger.info(`Found ${deletedTenants.length} deleted tenants to clean up`)

  for (const deletedTenant of deletedTenants) {
    if (!deletedTenant.tenantId) {
      logger.warn('Skipping deleted tenant with missing tenantId')
      continue
    }

    const tenantId = deletedTenant.tenantId
    logger.info(`Cleaning up tenant: ${tenantId}`)

    try {
      const tenantCollections = await allCollections(tenantId, db)
      logger.info(
        `Found ${tenantCollections.length} collections for tenant ${tenantId}`
      )

      // Get all deleted tenant IDs for quick lookup
      const deletedTenantIds = new Set(
        deletedTenants.map((tenant) => tenant.tenantId).filter(Boolean)
      )

      for (const collectionName of tenantCollections) {
        try {
          // 1. Extract tenant ID using first dash
          const tenantIdFromCollection = collectionName.slice(
            0,
            collectionName.indexOf('-')
          )

          // 2. Check if it is in the deleted tenants, yes then proceed
          if (deletedTenantIds.has(tenantIdFromCollection)) {
            await db.collection(collectionName).drop()
            logger.info(`Dropped MongoDB collection: ${collectionName}`)
          } else {
            logger.warn(
              `Tenant ${tenantIdFromCollection} not in deleted list, skipping ${collectionName}`
            )
          }
        } catch (error) {
          logger.warn(`Failed to drop collection ${collectionName}:`, error)
        }
      }

      // 2. Drop ClickHouse database for this tenant (if ClickHouse is enabled)
      if (isClickhouseEnabledInRegion()) {
        try {
          await executeClickhouseDefaultClientQuery(async (client) => {
            const tenantDbName = getClickhouseDbName(tenantId)
            await client.query({
              query: `DROP DATABASE IF EXISTS ${tenantDbName}`,
            })
            logger.info(
              `Dropped ClickHouse database (if exists): ${tenantDbName}`
            )
          })
        } catch (error) {
          logger.error(
            `Failed to drop ClickHouse database for tenant ${tenantId}:`,
            error
          )
        }
      }

      logger.info(`Successfully cleaned up tenant: ${tenantId}`)
    } catch (error) {
      logger.error(`Failed to cleanup tenant ${tenantId}:`, error)
    }
  }
  logger.info('Deleted tenant cleanup migration completed')
}

export const down = async () => {
  logger.warn(
    'This migration cannot be reversed - data has been permanently deleted'
  )
}
