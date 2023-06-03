import { migrateAllTenants } from '../utils/tenant'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { Tenant } from '@/services/accounts'
import { ARS_SCORES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const arsCollection = ARS_SCORES_COLLECTION(tenant.id)
  const db = mongoDb.db()

  const arsScoresCollection = db.collection<
    ArsScore & { PartitionKeyID: string }
  >(arsCollection)

  const arsScores = await arsScoresCollection.find({}).toArray()

  for await (const arsScore of arsScores) {
    const { PartitionKeyID } = arsScore
    const newTransactionId = PartitionKeyID.split(':')[1].split('#')[0]
    await arsScoresCollection.updateOne(
      { PartitionKeyID: arsScore.PartitionKeyID },
      { $set: { transactionId: newTransactionId } }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
