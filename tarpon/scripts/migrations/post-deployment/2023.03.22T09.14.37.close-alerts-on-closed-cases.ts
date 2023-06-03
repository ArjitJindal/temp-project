import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const casesCollectionName = CASES_COLLECTION(tenant.id)
  const db = mongoDb.db()
  const collection = db.collection<Case>(casesCollectionName)
  const cases = await collection.find({
    'alerts.alertStatus': 'OPEN',
    caseStatus: 'CLOSED',
  })

  for await (const case_ of cases) {
    const lastStatusChange = case_.lastStatusChange
    const modifiedAlerts = case_.alerts?.map((a) => {
      if (a.alertStatus === 'CLOSED') {
        return a
      }
      if (lastStatusChange) {
        a.lastStatusChange = lastStatusChange
        a.statusChanges?.push(lastStatusChange)
      }
      a.alertStatus = 'CLOSED'
      return a
    })

    await collection.updateOne(
      { _id: case_._id },
      { $set: { alerts: modifiedAlerts } }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
