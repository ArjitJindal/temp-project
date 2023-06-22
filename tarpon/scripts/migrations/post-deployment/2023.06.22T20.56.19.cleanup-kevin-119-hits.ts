import { migrateAllTenants } from '../utils/tenant'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'QEO03JYKBT') {
    return
  }

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))

  const ruleInstanceId = 'c0d8703d'

  const result = await casesCollection.updateMany(
    {
      alerts: { $elemMatch: { ruleInstanceId } },
      $expr: { $gt: [{ $size: '$alerts' }, 1] },
    },
    { $pull: { alerts: { ruleInstanceId } } }
  )

  console.log(
    `Removed ${result.modifiedCount} alerts from cases for tenant ${tenant.id}`
  )

  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  const result2 = await transactionsCollection.updateMany(
    {
      'hitRules.ruleInstanceId': ruleInstanceId,
    },
    {
      $pull: {
        hitRules: { ruleInstanceId },
        executedRules: { ruleInstanceId },
      },
    }
  )

  console.log(
    `Removed ${result2.modifiedCount} alerts from transactions for tenant ${tenant.id}`
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
