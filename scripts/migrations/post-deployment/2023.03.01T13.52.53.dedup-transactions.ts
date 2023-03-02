import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseTransaction } from '@/@types/openapi-internal/CaseTransaction'
import { Tenant } from '@/services/accounts'
import { transactionsToAlerts } from '@/services/alerts'

export async function dedupCaseTransactions(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const db = mongodb.db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const cases = await casesCollections.find({
    caseTransactionsIds: { $exists: true, $not: { $size: 0 } },
    caseTransactions: { $exists: true, $not: { $size: 0 } },
  })
  for await (const caseItem of cases) {
    const deduped: { [key: string]: CaseTransaction } | undefined =
      caseItem.caseTransactions?.reduce(
        (op: { [key: string]: CaseTransaction }, ct: CaseTransaction) => {
          op[ct.transactionId] = ct
          return op
        },
        {}
      )

    if (!deduped) {
      throw new Error(`No corrected transactions for case ${caseItem.caseId}`)
    }
    const caseTransactions = Object.values(deduped)
    const correctAlerts = transactionsToAlerts(caseTransactions)

    const correctedAlerts = caseItem.alerts?.map((a) => {
      if (!a.ruleInstanceId) {
        return a
      }

      const correctedAlert = correctAlerts[a.ruleInstanceId]
      if (!correctedAlert) {
        throw new Error(`No corrected transactions for alert ${a.alertId}`)
      }
      a.numberOfTransactionsHit = correctedAlert.numberOfTransactionsHit
      return a
    })

    await casesCollections.updateOne(
      { _id: caseItem._id },
      {
        $set: {
          alerts: correctedAlerts,
          caseTransactions,
          caseTransactionsIds: Object.keys(deduped),
        },
      }
    )
  }
}
export const up = async () => {
  await migrateAllTenants(dedupCaseTransactions)
}
export const down = async () => {
  // skip
}
