import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_WHITELIST_ENTITIES_COLLECTION } from '@/utils/mongodb-definitions'
import { CounterRepository } from '@/services/counter/repository'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()

  const db = mongoDb.db()
  const collectionName = SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenant.id)
  const collection = db.collection(collectionName)

  // Reserve ids
  const totalDocuments = await collection.countDocuments({})
  const counterRepo = new CounterRepository(tenant.id, mongoDb)
  const ids = await counterRepo.getNextCountersAndUpdate(
    'SanctionsWhitelist',
    totalDocuments
  )

  const findCursor = collection.find({})
  let updated = 0
  let i = 0
  for await (const doc of findCursor) {
    const documentUpdateResult = await collection.updateOne(
      {
        _id: doc._id,
      },
      {
        $set: {
          sanctionsWhitelistId: `SW-${ids[i]}`,
        },
      }
    )
    updated += documentUpdateResult.modifiedCount
    i++
  }
  logger.info(`Updates whitelist records: ${updated}`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
