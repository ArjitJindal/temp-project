import { StackConstants } from '@lib/constants'
import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import {
  CASES_COLLECTION,
  COUNTER_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/services/accounts'
import { transactionsToAlerts } from '@/services/alerts'
import { EntityCounter } from '@/@types/openapi-internal/EntityCounter'

export async function addTxnIdsToAlerts(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const db = mongodb.db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const cases = await casesCollections.find({
    caseTransactionsIds: { $exists: true, $not: { $size: 0 } },
    caseTransactions: { $exists: true, $not: { $size: 0 } },
  })

  for await (const caseItem of cases) {
    const correctAlerts = transactionsToAlerts(
      caseItem.caseTransactions || [],
      caseItem.caseId
    )
    const correctedAlerts = caseItem.alerts?.map((a) => {
      const corrected = correctAlerts.find(
        (corrected) => corrected.ruleInstanceId == a.ruleInstanceId
      )
      if (corrected) {
        a.numberOfTransactionsHit = corrected.numberOfTransactionsHit
        a.transactionIds = corrected.transactionIds
      }
      return a
    })

    await Promise.all(
      correctAlerts.map(async (correctAlert) => {
        // If it already exists, don't do anything.
        if (
          caseItem.alerts?.find(
            (existingAlert) =>
              correctAlert.ruleInstanceId === existingAlert.ruleInstanceId
          )
        ) {
          return
        }

        // Create the missing alert
        const counterCollection = db.collection<EntityCounter>(
          COUNTER_COLLECTION(tenant.id)
        )
        const alertCount = (
          await counterCollection.findOneAndUpdate(
            { entity: 'Alert' },
            { $inc: { count: 1 } },
            { upsert: true, returnDocument: 'after' }
          )
        ).value

        correctAlert.alertId = `A-${alertCount?.count}`
        correctedAlerts?.push(correctAlert)
      })
    )

    await casesCollections.updateOne(
      { _id: caseItem._id },
      {
        $set: {
          caseTransactionsIds: _.uniq(caseItem.caseTransactionsIds),
          alerts: correctedAlerts,
        },
      }
    )
  }
}
export const up = async () => {
  await migrateAllTenants(addTxnIdsToAlerts)
}
export const down = async () => {
  // skip
}
