import { isEqual } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import {
  TRANSACTIONS_COLLECTION,
  getMongoDbIndexDefinitions,
} from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const allIndexes = getMongoDbIndexDefinitions(tenant.id)
  const indexes = allIndexes[TRANSACTIONS_COLLECTION(tenant.id)].getIndexes()
  const db = await getMongoDbClientDb()
  const collection = db.collection(TRANSACTIONS_COLLECTION(tenant.id))
  const currentIndexes = await collection.indexes()
  const indexesToDrop = currentIndexes.filter(
    (desired) =>
      !isEqual({ _id: 1 }, desired.key) &&
      !indexes.find((current) => isEqual(desired.key, current.index))
  )

  if (indexesToDrop.length > 0) {
    for (const index of indexesToDrop) {
      await collection.dropIndex(index.key)
      logger.info(
        `Droped index - ${JSON.stringify(index)} (${collection.collectionName})`
      )
    }
  }

  const newCurrentIndexes = await collection.indexes()
  const indexesToCreate = indexes.filter(
    (desired) =>
      !newCurrentIndexes.find((current) => isEqual(desired.index, current.key))
  )

  if (indexesToCreate.length > 64) {
    throw new Error("Can't create more than 64 indexes")
  }

  if (indexesToCreate.length > 0) {
    for (const index of indexesToCreate) {
      await collection.createIndex(index.index, {
        unique: index.unique ?? false,
      })
      logger.info(
        `Created index - ${JSON.stringify(index)} (${
          collection.collectionName
        })`
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
