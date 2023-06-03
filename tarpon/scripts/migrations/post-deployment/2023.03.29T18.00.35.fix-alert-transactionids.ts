import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const collection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  for await (const c of collection.find({})) {
    const transactions = _.keyBy(c.caseTransactions, 'transactionId')
    let shouldUpdateCase = false
    c.alerts = (c.alerts ?? [])
      .map((alert) => {
        const alertTransactions = (
          alert.transactionIds?.map(
            (transactionId) => transactions[transactionId]
          ) || []
        ).filter(Boolean)
        const correctAlertTransactions = alertTransactions.filter(
          (transaction) =>
            transaction.hitRules.find(
              (rule) => rule.ruleInstanceId === alert.ruleInstanceId
            )
        )
        if (
          correctAlertTransactions.length !== alertTransactions.length &&
          correctAlertTransactions.length === 0
        ) {
          shouldUpdateCase = true
          return null
        }

        const shouldFixAlert =
          correctAlertTransactions.length !== alertTransactions.length
        if (shouldFixAlert) {
          shouldUpdateCase = true
          return {
            ...alert,
            latestTransactionArrivalTimestamp: _.maxBy(
              correctAlertTransactions,
              'timestamp'
            )!.timestamp,
            transactionIds: correctAlertTransactions.map(
              (transaction) => transaction.transactionId
            ),
            numberOfTransactionsHit: correctAlertTransactions.length,
          }
        }
        return alert
      })
      .filter(Boolean) as Alert[]

    if (shouldUpdateCase) {
      await collection.replaceOne(
        {
          _id: c._id,
        },
        c,
        { upsert: true }
      )
      console.log(`Updated Case ${c.caseId}`)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
