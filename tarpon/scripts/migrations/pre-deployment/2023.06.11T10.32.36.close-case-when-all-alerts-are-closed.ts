import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollectionName = CASES_COLLECTION(tenantId)

  const casesCollection = await db.collection<Case>(casesCollectionName)

  const cases = await casesCollection.find({
    caseStatus: { $ne: 'CLOSED' },
    createdTimestamp: { $gte: 1680300000000, $lte: 1683410400000 },
  })

  for await (const case_ of cases) {
    const { _id, alerts } = case_

    const isAllAlertsClosed = alerts?.every(
      (alert) => alert.alertStatus === 'CLOSED'
    )

    if (alerts?.length && isAllAlertsClosed) {
      await casesCollection.updateOne(
        { _id },
        {
          $set: {
            caseStatus: 'CLOSED',
            lastStatusChange: _.maxBy(alerts, 'lastStatusChange.timestamp')
              ?.lastStatusChange,
          },
          $push: {
            statusChanges: _.maxBy(alerts, 'lastStatusChange.timestamp')
              ?.lastStatusChange,
          },
        }
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
