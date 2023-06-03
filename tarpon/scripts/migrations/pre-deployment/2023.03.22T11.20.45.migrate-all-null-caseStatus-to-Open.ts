import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const casesCollectionName = CASES_COLLECTION(tenantId)
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const casesCollection = await db.collection<Case>(casesCollectionName)
  const cases = await casesCollection
    .find({ 'alerts.alertStatus': null })
    .toArray()

  for await (const case_ of cases) {
    const { _id, alerts } = case_

    if (alerts?.length) {
      for await (const alert of alerts) {
        if (alert.alertStatus === null) {
          if (alert.statusChanges?.length) {
            const lastStatusChange = _.maxBy(
              alert.statusChanges,
              'timestamp'
            ) as Alert['lastStatusChange']
            alert.alertStatus = lastStatusChange?.caseStatus
            alert.lastStatusChange = lastStatusChange
          } else {
            alert.alertStatus = case_.caseStatus
            delete alert.lastStatusChange
            delete alert.statusChanges
          }
        }
      }
    }
    await casesCollection.updateOne(
      { _id },
      {
        $set: {
          alerts,
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
