import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const casesCollection = await db.collection<Case>(CASES_COLLECTION(tenant.id))
  const casesCursor = await casesCollection.find({
    $and: [
      { 'alerts.alertStatus': 'OPEN' },
      { 'alerts.lastStatusChange.caseStatus': { $ne: 'OPEN' } },
    ],
  })

  for await (const c of casesCursor) {
    await casesCollection.updateOne(
      { _id: c._id },
      {
        $set: {
          alerts: c.alerts?.map((alert) => {
            if (
              alert.lastStatusChange?.caseStatus &&
              alert.alertStatus !== alert.lastStatusChange?.caseStatus
            ) {
              return {
                ...alert,
                alertStatus: alert.lastStatusChange.caseStatus,
              }
            }
            return alert
          }),
        },
      }
    )
    console.log(`Updated case ${c._id}`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
