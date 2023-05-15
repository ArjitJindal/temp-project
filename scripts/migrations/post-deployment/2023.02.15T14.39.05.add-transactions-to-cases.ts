import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import {
  CASES_COLLECTION,
  getMongoDbClient,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { Transaction } from '@/@types/openapi-internal/Transaction'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export async function addTransactionsToCases(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const db = mongodb.db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const transactionsCollections = db.collection<Transaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  const cases = await casesCollections.find({
    $or: [
      { caseTransactions: { $exists: false } },
      { 'caseTransactions.0': { $exists: false } },
    ],
    caseTransactionsIds: { $exists: true },
  })
  for await (const caseItem of cases) {
    const caseTransactionsCursor = await transactionsCollections.find({
      transactionId: { $in: caseItem.caseTransactionsIds },
    })
    const caseTransactions = await caseTransactionsCursor.toArray()
    await casesCollections.updateOne(caseItem, {
      $set: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        caseTransactions: caseTransactions as Array<InternalTransaction>,
      },
    })
  }
}

export const up = async () => {
  await migrateAllTenants(addTransactionsToCases)
}
export const down = async () => {
  // Put your migration code for rolling back here. If not applicable, skip it.
}
