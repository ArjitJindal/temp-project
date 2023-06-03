import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollectionName = CASES_COLLECTION(tenant.id)
  const casesCollection = db.collection<Case>(casesCollectionName)

  const cases = await casesCollection.find()

  for await (const case_ of cases) {
    const caseTransactionsCount = case_.caseTransactionsIds?.length ?? 0
    await casesCollection.updateOne(
      { _id: case_._id },
      {
        $set: {
          caseTransactionsCount,
        },
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
