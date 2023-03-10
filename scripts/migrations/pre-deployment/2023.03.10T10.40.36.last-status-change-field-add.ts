import { migrateAllTenants } from '../utils/tenant'
import { Alert } from '@/@types/openapi-internal/Alert'
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
    const lastStatusChange = statusChanges[statusChanges.length - 1]
    await casesCollection.updateOne(
      { _id: caseDoc._id },
      { $set: { lastStatusChange } }
    )
  }

  const allAlerts = await casesCollection
    .aggregate<{
      alerts: Alert
    }>([{ $unwind: '$alerts' }, { $project: { alerts: 1 } }])
    .toArray()
  for await (const alertDoc of allAlerts) {
    const { alerts } = alertDoc

    const { statusChanges } = alerts
    if (!statusChanges?.length) {
      continue
    }
    const lastStatusChange = statusChanges[statusChanges.length - 1]
    await casesCollection.updateOne(
      { 'alerts._id': alerts._id, caseId: alerts.caseId },
      { $set: { 'alerts.lastStatusChange': lastStatusChange } }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
