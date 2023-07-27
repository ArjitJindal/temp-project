import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/rules-engine/repositories/alerts-repository'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const cases = await casesCollection.find({
    'alerts.statusChanges.userId': FLAGRIGHT_SYSTEM_USER,
  })

  for await (const case_ of cases) {
    const alerts = case_.alerts
    const updatedAlerts = alerts?.map((alert) => {
      if (!alert.assignments?.length) {
        return alert
      }
      const assignment = alert.assignments[0]
      const statusChanges = alert.statusChanges?.map((statusChange) => {
        if (statusChange.userId === FLAGRIGHT_SYSTEM_USER) {
          return {
            ...statusChange,
            userId: assignment.assigneeUserId,
          }
        }
        return statusChange
      })
      return {
        ...alert,
        statusChanges,
      }
    })
    await casesCollection.updateOne(
      { _id: case_._id },
      { $set: { alerts: updatedAlerts } }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
