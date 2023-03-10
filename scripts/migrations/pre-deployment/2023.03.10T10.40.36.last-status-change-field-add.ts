import { migrateAllTenants } from '../utils/tenant'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollectionName = CASES_COLLECTION(tenantId)
  const casesCollection = db.collection<Case>(casesCollectionName)
  const allCases = await casesCollection.find({
    statusChanges: { $exists: true },
  })

  for await (const caseDoc of allCases) {
    const { statusChanges } = caseDoc
    if (!statusChanges?.length) {
      continue
    }

    const newCaseAlerts = caseDoc?.alerts?.map((alert) => {
      const statusChangesForAlert = alert.statusChanges

      if (!statusChangesForAlert?.length) {
        return alert
      }

      const lastStatusChange =
        statusChangesForAlert[statusChangesForAlert.length - 1]

      return {
        ...alert,
        lastStatusChange,
      }
    })

    const lastStatusChange = statusChanges[statusChanges.length - 1]
    await casesCollection.updateOne(
      { _id: caseDoc._id },
      { $set: { lastStatusChange, alerts: newCaseAlerts } }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
