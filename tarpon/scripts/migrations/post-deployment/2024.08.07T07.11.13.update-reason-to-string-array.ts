import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { SANCTIONS_WHITELIST_ENTITIES_COLLECTION } from '@/utils/mongodb-definitions'

const transformReasonField = (reasonString: string) => {
  return reasonString.split(',').map((reason) => reason.trim())
}

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const tenantId = tenant.id
  const collection = db.collection(
    SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenantId)
  )

  const cursor = collection.find({
    reason: { $type: 'string' },
  })

  for await (const doc of cursor) {
    const updatedReason = transformReasonField(doc.reason)

    await collection.updateOne(
      { _id: doc._id },
      { $set: { reason: updatedReason } }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
