import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { getMongoDbClient, TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = await mongoDb.db()
  const transactionCollection = db.collection<Case>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )
  await Promise.all(
    [
      'timestamp',
      'arsScore.arsScore',
      'arsScore.riskLevel',
      'transactionState',
      'originUserId',
      'destinationUserId',
      'originAmountDetails.transactionAmount',
      'destinationAmountDetails.transactionAmount',
    ].map(async (i) => {
      await transactionCollection.createIndex({ [i]: 1, _id: 1 })
      await transactionCollection.createIndex({ [i]: -1, _id: -1 })
      return
    })
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
