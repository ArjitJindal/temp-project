import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()

  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  for await (const _case of casesCollection.find({
    'alerts.[].ruleHitMeta': { $exists: false },
  })) {
    const updatedAlerts = _case.alerts?.map((a) => {
      const t = _case.caseTransactions?.find((t) =>
        t.hitRules.some((hr) => hr.ruleInstanceId === a.ruleInstanceId)
      )
      if (t) {
        const hitRule = t.hitRules.find(
          (hr) => hr.ruleInstanceId === a.ruleInstanceId && !!hr.ruleHitMeta
        )
        if (hitRule) {
          a.ruleHitMeta = hitRule.ruleHitMeta
        }
      }
      return a
    })
    await casesCollection.updateOne(
      { caseId: _case.caseId },
      {
        $set: {
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
