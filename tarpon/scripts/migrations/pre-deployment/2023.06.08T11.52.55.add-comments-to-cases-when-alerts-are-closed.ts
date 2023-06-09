import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollectionName = CASES_COLLECTION(tenantId)

  const casesCollection = await db.collection<Case>(casesCollectionName)

  const cases = await casesCollection
    .find({
      createdTimestamp: { $gte: 1680300000000, $lte: 1683410400000 },
    })
    .toArray()

  for await (const case_ of cases) {
    const { _id, alerts } = case_

    const closedAlertsWithoutComments: Alert[] | undefined = alerts?.filter(
      (alert) =>
        alert.alertStatus === 'CLOSED' &&
        (!alert.comments || alert?.comments?.length === 0)
    )

    if (
      alerts &&
      closedAlertsWithoutComments &&
      closedAlertsWithoutComments?.length > 0
    ) {
      console.info(`CaseId with the issue: ${case_.caseId}`)
      let shouldUpdateCase = false

      for (const alert of alerts) {
        if (
          alert.alertStatus === 'CLOSED' &&
          (!alert.comments || alert?.comments?.length === 0)
        ) {
          shouldUpdateCase = true

          if (alert.lastStatusChange && alert.lastStatusChange.reason) {
            console.info(`Alert Id: ${alert.alertId}`)
            alert.comments = []
            alert.comments.push({
              userId: alert.lastStatusChange.userId,
              id: uuidv4(),
              createdAt: alert.lastStatusChange.timestamp,
              updatedAt: alert.lastStatusChange.timestamp,
              body: `Alert status changed to CLOSED. Reasons: ${alert.lastStatusChange.reason.join(
                ', '
              )}`,
            })
          }
        }
      }
      if (shouldUpdateCase) {
        await casesCollection.updateOne(
          { _id },
          {
            $set: {
              alerts: alerts,
            },
          }
        )
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
