import { getMongoDbClient, prefixRegexMatchFilter } from '@/utils/mongodb-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { CASES_COLLECTION, USERS_COLLECTION } from '@/utils/mongo-table-names'

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

export async function searchAlert(tenantId, search) {
  const mongo = await getMongoDbClient()
  const db = mongo.db()

  const results = await db
    .collection<InternalUser>(CASES_COLLECTION(tenantId))
    .aggregate<{
      alertId: string
    }>([
      { $match: { 'alerts.alertId': prefixRegexMatchFilter(search, true) } },
      { $unwind: '$alerts' },
      { $match: { 'alerts.alertId': prefixRegexMatchFilter(search, true) } },
      { $project: { alertId: '$alerts.alertId' } },
      { $limit: 10 },
    ])
    .toArray()

  return results.map((r) => r.alertId)
}
