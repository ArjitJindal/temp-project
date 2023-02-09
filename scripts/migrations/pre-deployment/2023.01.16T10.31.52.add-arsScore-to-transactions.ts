import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { Tenant } from '@/services/accounts'
import {
  ARS_SCORES_COLLECTION,
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  if (!(await tenantHasFeature(tenant.id, 'PULSE'))) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const arsCollection = ARS_SCORES_COLLECTION(tenant.id)
  const casesCollection = CASES_COLLECTION(tenant.id)
  const transactionsCollection = TRANSACTIONS_COLLECTION(tenant.id)
  const arsScores = db.collection<ArsScore>(arsCollection).find({})

  for await (const arsScore of arsScores) {
    const { transactionId } = arsScore
    await db
      .collection<TransactionCaseManagement>(transactionsCollection)
      .updateOne({ transactionId }, { $set: { arsScore } })

    const casesDb = db.collection<Case>(casesCollection)
    const cases = await casesDb
      .find({ 'caseTransactions.transactionId': transactionId })
      .toArray()

    for (const _case of cases) {
      const { caseTransactions } = _case

      if (caseTransactions && caseTransactions?.length > 0) {
        const index = caseTransactions.findIndex(
          (transaction) => transaction.transactionId === transactionId
        )
        caseTransactions[index].arsScore = arsScore
        await db
          .collection<Case>(casesCollection)
          .updateOne({ _id: _case._id }, { $set: { caseTransactions } })
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
