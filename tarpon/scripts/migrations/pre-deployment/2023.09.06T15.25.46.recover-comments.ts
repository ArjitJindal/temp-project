import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { Comment } from '@/@types/openapi-internal/Comment'

async function migrateTenant(tenant: Tenant) {
  // Only migrate Kevin prod
  if (tenant.id !== 'QEO03JYKBT') {
    return
  }
  console.info(`Migrating QEO03JYKBT`)
  const mongodb = await getMongoDbClient()
  const db = mongodb.db()
  const usersCollection = db.collection<
    InternalConsumerUser | InternalBusinessUser
  >(USERS_COLLECTION(tenant.id))
  const recoveredCommentsCollection = db.collection<{
    userId: string
    comments: Array<Comment>
  }>('QEO03JYKBT-recovered-comments')
  const cursor = recoveredCommentsCollection.find()
  console.info(`Number of documents in cursor: ${await cursor.count()}`) // Log the number of documents
  for await (const c of cursor) {
    const userObj = await usersCollection.findOne({ userId: c.userId })
    if (userObj) {
      await usersCollection.updateOne(
        { userId: userObj.userId },
        {
          $set: {
            comments: c.comments,
          },
        }
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
