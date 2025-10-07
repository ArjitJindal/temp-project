import { FindCursor, MongoError, ObjectId } from 'mongodb'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils/env'
import { TenantService } from '../tenants'
import { BatchJobRunner } from './batch-job-runner-base'
import {
  SANCTIONS_SCREENING_DETAILS_COLLECTION,
  SANCTIONS_SCREENING_DETAILS_V2_COLLECTION,
} from '@/utils/mongo-table-names'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { SanctionsScreeningDetailsMigrationBatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { SanctionsScreeningDetailsV2 } from '@/@types/openapi-internal/SanctionsScreeningDetailsV2'
import { batchInsertToClickhouse } from '@/utils/clickhouse/insert'
import {
  getMigrationLastCompletedId,
  updateMigrationLastCompletedId,
} from '@/utils/migration-progress'
import { tenantHasFeature } from '@/core/utils/context'

export class SanctionsScreeningDetailsMigrationBatchJobRunner extends BatchJobRunner {
  async run(_job: SanctionsScreeningDetailsMigrationBatchJob) {
    const [stage, region] = stageAndRegion()
    const config = getTarponConfig(stage, region)
    const tenantInfos = await TenantService.getAllTenants(
      config.stage,
      config.region
    )
    for (const tenantInfo of tenantInfos) {
      const tenantId = tenantInfo.tenant.id
      const hasFeature = await tenantHasFeature(tenantId, 'SANCTIONS')
      if (!hasFeature) {
        continue
      }
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          await this.migrateForTenant(tenantId)
          logger.info(
            `Sanctions screening details migration completed for tenant ${tenantId}`
          )
          break
        } catch (error) {
          if ((error as MongoError).code === 43) {
            logger.error(`Cursor expired, retrying for tenant ${tenantId}...`)
            continue
          }
          throw error
        }
      }
    }
    logger.info(
      'Sanctions screening details migration completed for all tenants'
    )
  }

  private async migrateForTenant(tenantId: string) {
    const migrationKey = `sanctions-screening-details-migration-${tenantId}`
    const lastProcessedId = await getMigrationLastCompletedId(migrationKey)
    logger.info(
      `Starting migration for tenant ${tenantId}, lastProcessedId: ${lastProcessedId}`
    )

    const client = await getMongoDbClient()

    const sourceCollectionName =
      SANCTIONS_SCREENING_DETAILS_COLLECTION(tenantId)
    const destCollectionName =
      SANCTIONS_SCREENING_DETAILS_V2_COLLECTION(tenantId)

    const db = client.db()
    const sourceCollection = db.collection(sourceCollectionName)
    const destCollection = db.collection(destCollectionName)

    const query = lastProcessedId
      ? {
          _id: {
            $gt: new ObjectId(lastProcessedId),
          },
        }
      : {}
    const cursor = sourceCollection
      .find(query)
      .sort({
        _id: 1,
      })
      .addCursorFlag('noCursorTimeout', true) as FindCursor<any>
    const maxReferenceCounterDoc = await destCollection
      .find({}, { projection: { referenceCounter: 1 } })
      .sort({ referenceCounter: -1 })
      .limit(1)
      .toArray()
    const maxReferenceCounter = maxReferenceCounterDoc[0]?.referenceCounter
    let screeningId = maxReferenceCounter ? maxReferenceCounter : 0
    await processCursorInBatch(
      cursor,
      async (batch) => {
        const newDocuments: SanctionsScreeningDetailsV2[] = []
        for (const doc of batch) {
          if (doc.userIds && doc.userIds.length > 0) {
            for (const userId of doc.userIds) {
              screeningId += 1
              const { _id, userIds, transactionIds, ...remainingDoc } = doc // eslint-disable-line @typescript-eslint/no-unused-vars
              newDocuments.push({
                ...remainingDoc,
                userId,
                screeningId: `S-${screeningId}`,
                latestTimeStamp: remainingDoc.lastScreenedAt,
                referenceCounter: screeningId,
              })
            }
          }
          if (doc.transactionIds && doc.transactionIds.length > 0) {
            for (const transactionId of doc.transactionIds) {
              screeningId += 1
              const { _id, userIds, transactionIds, ...remainingDoc } = doc // eslint-disable-line @typescript-eslint/no-unused-vars
              newDocuments.push({
                ...remainingDoc,
                transactionId,
                screeningId: `S-${screeningId}`,
                latestTimeStamp: remainingDoc.lastScreenedAt,
                referenceCounter: screeningId,
              })
            }
          }
        }

        if (newDocuments.length > 0) {
          await destCollection.insertMany(newDocuments)
          logger.info(
            `Successfully inserted batch of ${newDocuments.length} documents into MongoDB.`
          )
          await batchInsertToClickhouse(
            tenantId,
            CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS_V2.tableName,
            newDocuments
          )
          const lastIdInBatch = batch[batch.length - 1]._id
          if (lastIdInBatch) {
            await updateMigrationLastCompletedId(
              migrationKey,
              lastIdInBatch.toString()
            )
          }
        }
      },
      {
        mongoBatchSize: 1000,
        processBatchSize: 1000,
        debug: true,
      }
    )
  }
}
