import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/services/accounts'
import { transactionsToAlerts } from '@/services/alerts'

export async function addTxnIdsToAlerts(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const db = mongodb.db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const cases = await casesCollections.find({
    caseTransactionsIds: { $exists: true, $not: { $size: 0 } },
    caseTransactions: { $exists: true, $not: { $size: 0 } },
  })

  for await (const caseItem of cases) {
    const correctAlerts = transactionsToAlerts(
      caseItem.caseTransactions || [],
      caseItem.caseId
    )
    const correctedAlerts = caseItem.alerts?.map((a) => {
      const corrected = correctAlerts.find(
        (corrected) => corrected.ruleInstanceId == a.ruleInstanceId
      )
      if (corrected) {
        a.numberOfTransactionsHit = corrected.numberOfTransactionsHit
        a.transactionIds = corrected.transactionIds
      }
      return a
    })
    await casesCollections.updateOne(
      { _id: caseItem._id },
      {
        $set: {
          alerts: correctedAlerts,
        },
      }
    )
  }
}
export const up = async () => {
  await migrateAllTenants(addTxnIdsToAlerts)
}
export const down = async () => {
  // skip
}
