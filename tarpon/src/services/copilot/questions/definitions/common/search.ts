import { getMongoDbClient, prefixRegexMatchFilter } from '@/utils/mongodb-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'

export async function searchUser(tenantId, search) {
  const mongo = await getMongoDbClient()
  const db = mongo.db()

  const results = await db
    .collection<InternalUser>(USERS_COLLECTION(tenantId))
    .aggregate<{ userId: string }>([
      { $match: { userId: prefixRegexMatchFilter(search, true) } },
      { $project: { userId: 1 } },
      { $limit: 10 },
    ])
    .toArray()

  return results.map((r) => r.userId)
}
