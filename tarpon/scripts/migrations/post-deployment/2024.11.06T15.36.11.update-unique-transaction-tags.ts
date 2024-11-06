import { compact } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  UNIQUE_TAGS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const uniqueTransactionTagsCollectionName = `${tenant.id}-unique-transaction-tags`
  const uniqueTransactionTagsCollection = db.collection(
    uniqueTransactionTagsCollectionName
  )
  const uniqueTagsCollection = db.collection(UNIQUE_TAGS_COLLECTION(tenant.id))

  const isUniqueTagsCollectionExists =
    (
      await db
        .listCollections({ name: UNIQUE_TAGS_COLLECTION(tenant.id) })
        .toArray()
    ).length > 0

  if (isUniqueTagsCollectionExists) {
    // If Unique Tags Collection exists, we assume that the migration is already done
    return
  }

  const uniqueTags = compact(
    await uniqueTransactionTagsCollection.distinct('tag')
  )

  await Promise.all(
    uniqueTags.map(async (tag) => {
      await uniqueTagsCollection.updateOne(
        { tag, type: 'TRANSACTION' },
        { $set: { tag, type: 'TRANSACTION' } },
        { upsert: true }
      )
    })
  )

  const usersCollection = db.collection<InternalUser>(
    USERS_COLLECTION(tenant.id)
  )

  const uniqueUserTags = compact(await usersCollection.distinct('tags.key'))

  for (const tag of uniqueUserTags) {
    await uniqueTagsCollection.updateOne(
      { tag, type: 'USER' },
      { $set: { tag, type: 'USER' } },
      { upsert: true }
    )
  }

  const isCollectionExists =
    (
      await db
        .listCollections({ name: uniqueTransactionTagsCollectionName })
        .toArray()
    ).length > 0

  if (isCollectionExists) {
    await db.dropCollection(uniqueTransactionTagsCollectionName)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
