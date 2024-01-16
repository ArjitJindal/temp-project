import { migrateRuleInstance } from '../utils/rule'
import { migrateAllTenants } from '../utils/tenant'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const caseCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const cursor = caseCollection.find({ 'alerts.ruleId': 'R-54' })
  for await (const a of cursor) {
    const alerts = a.alerts?.map((alert) => {
      if (alert.ruleId === 'R-54') {
        alert.ruleId = 'R-55'
        alert.ruleDescription =
          'Same sender user using >= ‘x’ unique payment identifiers in time ‘t’.'
        alert.ruleName = 'Same sender user using too many payment identifiers.'
      }
      return alert
    })
    await caseCollection.updateOne({ _id: a._id }, { $set: { alerts: alerts } })
  }
}
export const up = async () => {
  await migrateRuleInstance('R-54', 'R-55', (ruleInstance: RuleInstance) => {
    ruleInstance = {
      ...ruleInstance,
      parameters: {
        ...ruleInstance.parameters,
        uniquePaymentIdentifiersCountThreshold:
          ruleInstance.parameters.uniqueCardsCountThreshold,
        timeWindow: ruleInstance.parameters.timeWindow,
      },
      filters: {
        ...ruleInstance?.filters,
        originPaymentFilters: {
          ...ruleInstance?.filters?.originPaymentFilters,
          paymentMethods: ['CARD'],
        },
        paymentMethodsHistorical: ['CARD'],
      },
    }
    return ruleInstance
  })
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
