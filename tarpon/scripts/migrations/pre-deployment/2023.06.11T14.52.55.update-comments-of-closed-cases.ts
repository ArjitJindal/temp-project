import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollectionName = CASES_COLLECTION(tenantId)

  const casesCollection = await db.collection<Case>(casesCollectionName)

  const cases = await casesCollection.find({
    caseStatus: 'CLOSED',
  })

  for await (const case_ of cases) {
    const { _id, comments } = case_
    if (comments) {
      for (let i = 0; i < comments.length; i++) {
        if (
          comments[i].body &&
          case_.lastStatusChange?.reason &&
          comments[i].body.includes('Case status changed to CLOSED')
        ) {
          comments[i].body += `. Reason: ${case_.lastStatusChange?.reason.join(
            ', '
          )}`
        }
      }

      await casesCollection.updateOne(
        { _id },
        {
          $set: {
            comments: comments,
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
