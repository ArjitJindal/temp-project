import { AnyBulkWriteOperation } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { SANCTIONS_WHITELIST_ENTITIES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { complyAdvantageDocToEntity } from '@/services/sanctions/providers/comply-advantage-provider'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== '4b75093ae2') {
    return
  }
  const db = await getMongoDbClientDb()
  const collection = db.collection<SanctionsWhitelistEntity>(
    SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenant.id)
  )
  let operations: AnyBulkWriteOperation<SanctionsWhitelistEntity>[] = []
  const whitelistEntities = await collection
    .find({
      sanctionsEntity: undefined,
    })
    .toArray()
  let counter = 0
  for (const whitelistEntity of whitelistEntities) {
    if (whitelistEntity.caEntity) {
      const sanctionsEntity = complyAdvantageDocToEntity({
        doc: whitelistEntity.caEntity,
      })
      operations.push({
        updateOne: {
          filter: {
            sanctionsWhitelistId: whitelistEntity.sanctionsWhitelistId,
          },
          update: { $set: { sanctionsEntity } },
        },
      })
    }
    if (operations.length === 1000) {
      await collection.bulkWrite(operations)
      operations = []
      counter += 1000
      logger.info(
        `Processed ${counter} of ${whitelistEntities.length} whitelist entities`
      )
    }
  }
  if (operations.length) {
    counter += operations.length
    logger.info(
      `Processed ${counter} of ${whitelistEntities.length} whitelist entities`
    )
    await collection.bulkWrite(operations)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
