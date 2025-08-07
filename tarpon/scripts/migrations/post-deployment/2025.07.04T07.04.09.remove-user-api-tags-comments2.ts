import { AnyBulkWriteOperation } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { hasFeature } from '@/core/utils/context'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { envIs } from '@/utils/env'

const commentTagBody = 'User API tags updated over the console'
const commentPepBody = 'PEP status updated manually by'
async function migrateTenant(tenant: Tenant) {
  if (
    !hasFeature('NEW_FEATURES') ||
    (envIs('prod') && tenant.id === '0789ad73b8')
  ) {
    const mongodDb = await getMongoDbClient()
    const db = mongodDb.db()
    const usersCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenant.id)
    )
    // Create temporary indexes
    await usersCollection.createIndex(
      { 'comments.createdAt': 1 },
      { name: 'temp_comments_created_at_index' }
    )
    await usersCollection.createIndex(
      { 'comments.body': 1 },
      { name: 'temp_comments_body_index' }
    )

    const users = usersCollection.find({
      'comments.createdAt': { $gte: 1747247400000 },
      'comments.body': {
        $regex: 'User status changed from to by',
        $options: 'i',
      },
    })
    // #6651 was merged to main on 15 May 2025 IST

    await processCursorInBatch(users, async (users) => {
      const bulkOperation: AnyBulkWriteOperation[] = []

      for (const user of users) {
        // remove comments
        if (user.userId) {
          const filteredComments =
            user.comments?.filter((comment) => {
              if (comment.createdAt && comment.body) {
                return !(
                  comment.createdAt >= 1747247400000 &&
                  (comment.body === commentTagBody ||
                    comment.body.match(commentPepBody))
                )
              }
              return true
            }) ?? []

          bulkOperation.push({
            updateOne: {
              filter: { userId: user.userId },
              update: {
                $set: {
                  comments: filteredComments,
                },
              },
            },
          })
        }
      }

      if (bulkOperation.length > 0) {
        await db
          .collection(USERS_COLLECTION(tenant.id))
          .bulkWrite(bulkOperation)
      }
    })

    // Drop temporary indexes after migration
    await usersCollection.dropIndex('temp_comments_created_at_index')
    await usersCollection.dropIndex('temp_comments_body_index')
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
