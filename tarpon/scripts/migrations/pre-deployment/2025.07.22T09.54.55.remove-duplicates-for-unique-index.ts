import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, withTransaction } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { ARS_SCORES_COLLECTION } from '@/utils/mongodb-definitions'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'

async function migrateTenant(tenant: Tenant) {
  const mongoClient = await getMongoDbClient()

  // remove duplicates from ars_scores collection and keep latest
  const arsScores = mongoClient
    .db()
    .collection<ArsScore>(ARS_SCORES_COLLECTION(tenant.id))
    .aggregate<{ transactionId: string }>([
      { $group: { _id: '$transactionId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $project: { _id: 0, transactionId: '$_id' } },
    ])
    .addCursorFlag('noCursorTimeout', true)

  for await (const arsScore of arsScores) {
    const arsScores = await mongoClient
      .db()
      .collection<ArsScore>(ARS_SCORES_COLLECTION(tenant.id))
      .find({ transactionId: arsScore.transactionId })
      .toArray()

    const latestArsScore = arsScores.sort(
      (a, b) => b.createdAt - a.createdAt
    )[0]

    console.log(
      `Removing duplicates for transactionId: ${arsScore.transactionId}`
    )

    await withTransaction(async () => {
      await mongoClient
        .db()
        .collection<ArsScore>(ARS_SCORES_COLLECTION(tenant.id))
        .deleteMany({ transactionId: arsScore.transactionId })

      await mongoClient
        .db()
        .collection<ArsScore>(ARS_SCORES_COLLECTION(tenant.id))
        .insertOne(latestArsScore)
    })

    console.log(
      `Removed duplicates for transactionId: ${arsScore.transactionId}`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
