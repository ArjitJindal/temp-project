import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))

  const allCases = await casesCollection.find({})

  for await (const caseItem of allCases) {
    let updatedAt = caseItem.createdTimestamp || 0
    const updatedAlerts = caseItem?.alerts?.map((alert) => {
      const alertUpdatedAt = Math.max(
        alert.createdTimestamp || 0,
        alert?.lastStatusChange?.timestamp || 0
      )
      updatedAt = Math.max(updatedAt, alertUpdatedAt)
      return {
        ...alert,
        updatedAt: alertUpdatedAt,
      }
    })

    await casesCollection.updateOne(
      { _id: caseItem._id },
      {
        $set: {
          updatedAt: Math.max(
            updatedAt,
            caseItem.lastStatusChange?.timestamp || 0
          ),
          alerts: updatedAlerts,
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
