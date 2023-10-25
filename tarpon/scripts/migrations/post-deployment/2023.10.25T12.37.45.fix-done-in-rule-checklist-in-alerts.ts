import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollectionName = CASES_COLLECTION(tenant.id)
  const casesCollection = db.collection<Case>(casesCollectionName)

  const casesCursor = await casesCollection.find({
    $or: [
      { 'alerts.ruleChecklist.done': true },
      { 'alerts.ruleChecklist.done': false },
    ],
  })

  for await (const c of casesCursor) {
    const alerts = c?.alerts?.map((a) => {
      if (a.ruleChecklist) {
        const ruleChecklist = a.ruleChecklist.map((r) => {
          if (typeof r.done === 'boolean') {
            return {
              ...r,
              done: r.done ? ('DONE' as const) : ('NOT_STARTED' as const),
            }
          }
          return r
        })

        return {
          ...a,
          ruleChecklist,
        }
      }
      return a
    })

    await casesCollection.updateOne({ _id: c._id }, { $set: { alerts } })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
