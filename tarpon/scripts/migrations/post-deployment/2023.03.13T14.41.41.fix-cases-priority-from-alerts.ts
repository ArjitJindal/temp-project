import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection<Case>(CASES_COLLECTION(tenant.id))

  for await (const case_ of collection.find({})) {
    await collection.updateOne(
      { _id: case_._id },
      {
        $set: {
          priority:
            _.minBy(case_.alerts, 'priority')?.priority ?? _.last(PRIORITYS),
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
