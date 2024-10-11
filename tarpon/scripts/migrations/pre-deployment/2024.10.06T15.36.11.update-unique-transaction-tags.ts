import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  UNIQUE_TRANSACTION_TAGS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )
  const uniqueTagsCollection = db.collection(
    UNIQUE_TRANSACTION_TAGS_COLLECTION(tenant.id)
  )

  const uniqueTags = await transactionsCollection.distinct('tags.key')

  for (const tag of uniqueTags) {
    await uniqueTagsCollection.updateOne(
      { tag },
      { $set: { tag } },
      { upsert: true }
    )
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
