import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'

export async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const db = mongodb.db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))

  const cases = await casesCollections.find({
    caseTransactions: { $exists: true },
    caseTransactionsIds: { $exists: false },
  })
  let caseItem = null
  do {
    if (caseItem != null) {
      console.log(`Migrating case ${caseItem.caseId}`)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const caseTransactions = caseItem.caseTransactions as CaseTransaction[]
      const ids: string[] = caseTransactions.map(
        ({ transactionId }) => transactionId as string
      )
      await casesCollections.updateOne(caseItem, {
        $unset: {
          caseTransactions: '',
        },
        $set: {
          caseTransactionsIds: ids,
        },
      })
    }
    caseItem = await cases.next()
  } while (caseItem != null)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // Put your migration code for rolling back here. If not applicable, skip it.
}
