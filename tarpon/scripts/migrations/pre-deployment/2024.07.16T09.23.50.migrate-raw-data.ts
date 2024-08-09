import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_HITS_COLLECTION } from '@/utils/mongodb-definitions'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()

  const db = mongoDb.db()

  const collection = db.collection(SANCTIONS_HITS_COLLECTION(tenant.id))
  let updated = 0
  for await (const hit of collection.find({})) {
    if (hit.caRawData != null) {
      logger.debug(`Updating hit ${hit.sanctionsHitId}}`)
      const updateResult = await collection.updateOne(
        {
          sanctionsHitId: hit.sanctionsHitId,
        },
        {
          $set: {
            caEntity: hit.caRawData.doc,
          },
        }
      )
      updated += updateResult.modifiedCount
    }
  }
  logger.info(`Updated ${updated} hits`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
