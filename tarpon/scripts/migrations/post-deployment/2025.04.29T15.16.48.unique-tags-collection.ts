import { chunk } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { processCursorInBatch, getMongoDbClient } from '@/utils/mongodb-utils'
import {
  UNIQUE_TAGS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Tenant } from '@/services/accounts/repository'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient()

  // Process transactions
  const transactionsCollection = mongodb
    .db()
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenant.id))
  const usersCollection = mongodb.db().collection(USERS_COLLECTION(tenant.id))
  const uniqueTagsCollection = mongodb
    .db()
    .collection(UNIQUE_TAGS_COLLECTION(tenant.id))

  const uniqueSet = new Set<string>()
  const result: { key: string; value: string; type: 'TRANSACTION' | 'USER' }[] =
    []

  // Process transactions tags
  await processCursorInBatch(
    transactionsCollection.find({}),
    async (transactions) => {
      const batchTags = transactions.flatMap((t) => t.tags)
      for (const tag of batchTags) {
        if (!tag) {
          continue
        }
        const uniqueKey = `${tag.key}-${tag.value}`
        if (uniqueSet.has(uniqueKey)) {
          continue
        }
        uniqueSet.add(uniqueKey)
        result.push({ key: tag.key, value: tag.value, type: 'TRANSACTION' })
      }
    },
    { debug: true }
  )

  // Process users tags
  await processCursorInBatch(
    usersCollection.find({}),
    async (users) => {
      const batchTags = users.flatMap((u) => u.tags)
      for (const tag of batchTags) {
        if (!tag) {
          continue
        }
        const uniqueKey = `${tag.key}-${tag.value}`
        if (uniqueSet.has(uniqueKey)) {
          continue
        }
        uniqueSet.add(uniqueKey)
        result.push({ key: tag.key, value: tag.value, type: 'USER' })
      }
    },
    { debug: true }
  )

  // Process updates in batches
  for (const batch of chunk(result, 100)) {
    await Promise.all(
      batch.map((tag) =>
        uniqueTagsCollection.updateOne(
          {
            type: tag.type,
            tag: tag.key,
          },
          { $set: { value: tag.value } },
          { upsert: true }
        )
      )
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
